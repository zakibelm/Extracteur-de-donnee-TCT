import { extractWithOpenRouter } from '../server/openRouterExtraction.js';
import { TCT_EXTRACTION_INSTRUCTIONS } from '../server/extractionPrompt.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, HttpError } from '../server/auth.js';
import { validateTable, validateTctTable, normalizeTctExtraction } from '../src/utils/table.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
    try {
        const user = await requireAdmin(req);
        const { image, section, mimeType } = req.body || {};
        if (!['tct', 'olymel'].includes(section) || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ||
            typeof image !== 'string' || !image.length || image.length > 3_500_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image)) {
            throw new HttpError(400, 'Image ou type de document invalide (maximum environ 2,6 Mo).');
        }
        const webhook = process.env.N8N_EXTRACT_WEBHOOK;
        const secret = process.env.N8N_WEBHOOK_SECRET;
        const clientKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].trim() : '';
        let raw;
        if (!clientKey && webhook && secret && new URL(webhook).protocol === 'https:') {
            const response = await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': secret },
                body: JSON.stringify({ image, section, mimeType, user_id: user.id,
                    user_dome: user.user_metadata?.numDome || '', timestamp: new Date().toISOString(),
                    ...(section === 'tct' ? { extraction_instructions: TCT_EXTRACTION_INSTRUCTIONS } : {}) }),
                signal: AbortSignal.timeout(110_000), redirect: 'error',
            });
            if (!response.ok) throw new HttpError(502, 'Service extraction indisponible. Réessayez.');
            raw = await response.json();
        } else {
            const key = clientKey || process.env.OPENROUTER_API_KEY;
            if (typeof key !== 'string' || !key.trim()) {
                throw new HttpError(503, 'Analyse non configurée. Ouvrez Paramètres, ajoutez votre clé OpenRouter puis cliquez sur Sauvegarder.');
            }
            raw = await extractWithOpenRouter({ image, section, mimeType, model: req.body.model }, key.trim());
        }
        let result;
        try { result = section === 'tct' ? normalizeTctExtraction(raw) : validateTable(raw); }
        catch (error) { throw new HttpError(502, error instanceof Error ? `Extraction à vérifier : ${error.message}` : 'Structure du document non reconnue.'); }
        return res.status(200).json(result);
    } catch (error) {
        return res.status(error instanceof HttpError ? error.status : 502).json({
            error: error instanceof HttpError ? error.message : 'Échec extraction. Réessayez.',
        });
    }
}
