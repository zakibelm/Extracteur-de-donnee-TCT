import { HttpError } from './auth.js';
import { requireVisionModel } from './visionModels.js';
import { TCT_EXTRACTION_INSTRUCTIONS } from './extractionPrompt.js';

export async function extractWithOpenRouter(input: { image: string; mimeType: string; section: string; model?: string; test?: boolean }, apiKey: string) {
    const model = input.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    if (!/^[a-zA-Z0-9_~./:-]{1,120}$/.test(model)) throw new HttpError(400, 'Modèle invalide.');
    const capabilities = await requireVisionModel(model);
    const instructions = input.test ? 'Regarde cette image de test. Retourne uniquement le JSON {"ok":true}.' : input.section === 'tct' ? TCT_EXTRACTION_INSTRUCTIONS :
        'Extrais les lignes visibles de cet horaire Olymel. Retourne uniquement un JSON headers=[Date,Heure,Transport,Numéro,Chauffeur], rows=tableau de tableaux de chaînes. Ne complète pas les données illisibles.';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model,
            ...(capabilities.supportedParameters.includes('temperature') ? { temperature: 0.1 } : {}),
            max_tokens: Math.min(input.test ? 256 : 12000, capabilities.maxCompletionTokens),
            ...(capabilities.supportedParameters.includes('response_format') ? { response_format: { type: 'json_object' } } : {}),
            provider: { require_parameters: true },
            messages: [{ role: 'system', content: instructions }, { role: 'user', content: [
                { type: 'text', text: input.test ? 'Confirme la lecture de cette image avec le JSON demandé.' : 'Lis ce document et extrais uniquement ses données visibles.' },
                { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.image}` } },
            ] }],
        }),
        signal: AbortSignal.timeout(110_000),
    });
    if (!response.ok) {
        let detail = '';
        try { detail = String((await response.json())?.error?.message || ''); } catch { /* Never expose upstream payloads. */ }
        const message = response.status === 401 ? 'Clé OpenRouter invalide. Vérifiez les paramètres.' :
            response.status === 402 ? 'Crédits OpenRouter insuffisants pour cette analyse. Rechargez le compte ou choisissez un modèle moins coûteux.' :
            response.status === 403 ? 'Accès refusé par OpenRouter. Vérifiez les autorisations et les restrictions de votre clé.' :
            response.status === 404 ? 'Aucun fournisseur disponible pour ce modèle. Actualisez la liste et choisissez un autre modèle vision.' :
            response.status === 429 ? 'Le moteur est temporairement limité. Réessayez dans un instant ou choisissez un autre modèle.' :
            response.status === 400 || response.status === 422 ?
                (/image|vision|multimodal/i.test(detail) ? 'Ce fournisseur refuse les images. Choisissez un autre modèle vision dans Paramètres.' :
                /response_format|parameter/i.test(detail) ? 'Ce fournisseur refuse les paramètres de sortie. Choisissez un autre modèle vision.' :
                'OpenRouter a refusé la requête. Testez le modèle dans Paramètres ou choisissez un autre modèle vision.') :
            'Le fournisseur OpenRouter est indisponible. Réessayez ou choisissez un autre modèle vision.';
        throw new HttpError(response.status === 429 ? 429 : 502, message);
    }
    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') throw new HttpError(502, 'Résultat trop long. Séparez le document en plusieurs images.');
    const text = choice?.message?.content;
    if (typeof text !== 'string') throw new HttpError(502, 'Le moteur n’a retourné aucun tableau.');
    try { return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()); }
    catch { throw new HttpError(502, 'Résultat illisible. Réessayez avec une image plus nette.'); }
}
