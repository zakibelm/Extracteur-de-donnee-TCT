import { requireAdmin, HttpError } from '../server/auth.js';
import { extractWithOpenRouter } from '../server/openRouterExtraction.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// A synthetic pixel tests the same vision path as extraction; no user document is sent.
const TEST_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
    try {
        await requireAdmin(req);
        const key = req.headers['x-api-key'];
        const model = req.headers['x-model'];
        if (typeof key !== 'string' || !key.trim()) throw new HttpError(400, 'Clé OpenRouter requise.');
        if (typeof model !== 'string') throw new HttpError(400, 'Modèle requis.');
        await extractWithOpenRouter({ image: TEST_IMAGE, mimeType: 'image/png', section: 'tct', model, test: true }, key.trim());
        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(error instanceof HttpError ? error.status : 502).json({
            error: error instanceof HttpError ? error.message : 'Le test a échoué. Réessayez.',
        });
    }
}
