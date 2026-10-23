import { HttpError } from './auth.js';
import { TCT_EXTRACTION_INSTRUCTIONS } from './extractionPrompt.js';

export async function extractWithOpenRouter(input: { image: string; mimeType: string; section: string; model?: string }, apiKey: string) {
    const model = input.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    if (!/^[a-zA-Z0-9_./:-]{1,120}$/.test(model)) throw new HttpError(400, 'Modèle invalide.');
    const instructions = input.section === 'tct' ? TCT_EXTRACTION_INSTRUCTIONS :
        'Extrais les lignes visibles de cet horaire Olymel. Retourne uniquement un JSON headers=[Date,Heure,Transport,Numéro,Chauffeur], rows=tableau de tableaux de chaînes. Ne complète pas les données illisibles.';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, temperature: 0.1, max_tokens: 12000,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: instructions }, { role: 'user', content: [
                { type: 'text', text: 'Lis ce document et extrais uniquement ses données visibles.' },
                { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.image}` } },
            ] }],
        }),
        signal: AbortSignal.timeout(110_000),
    });
    if (!response.ok) {
        const message = response.status === 401 ? 'Clé OpenRouter invalide. Vérifiez les paramètres.' :
            response.status === 402 ? 'Le compte OpenRouter ne dispose pas de crédits suffisants.' :
            response.status === 429 ? 'Le moteur est temporairement limité. Réessayez dans un instant.' :
            'Le moteur n’a pas pu analyser cette image. Vérifiez que le modèle accepte les images.';
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
