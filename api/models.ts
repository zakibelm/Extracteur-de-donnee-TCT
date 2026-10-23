import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getVisionModels } from '../server/visionModels.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée.' });
    try {
        const models = await getVisionModels();
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
        return res.status(200).json({ models });
    } catch {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(503).json({ error: 'Impossible de charger les modèles OpenRouter. Réessayez.' });
    }
}
