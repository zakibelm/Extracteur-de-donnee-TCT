import { requireAdmin, HttpError } from '../server/auth.js';
import { extractWithOpenRouter } from '../server/openRouterExtraction.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// A synthetic image tests the same vision path as extraction; no user document is sent.
const TEST_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAABIklEQVR4nO3ZIW6EUBSF4TcNHsUYPAuABfBAYFgAEoVhDWwDxQYQJDgEG8DikeyBAAl5FSQ1bTPz2g4nTc6nbsgluX/CqLkppcR/9oY+4LcYgMYANAagMQCNAWgMQGMAGgPQGIDGADQGoDEA7UFA27ZSSimlYRjn0DRNVVWu6/q+H8fxPM/frV1yvxDqOaZpnkPf90EQLMuilOq6LgzDL9cuox0QRdEwDB/Psyzb9/3z2mW0A2zbXtf14dpltH/Ex3G84kv+Me0Ax3HGcTxnpVSapn98kSbtgDzPi6LYtk0IUdf1OQAZui8kSTJNk+d5lmXd7/eyLF9x1vNuiv/QYDEAjQFoDEBjABoD0BiAxgA0BqAxAI0BaAxAYwAaA9AYgPYOB1lVltAha/IAAAAASUVORK5CYII=';
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
    try {
        await requireAdmin(req);
        const key = req.headers['x-api-key'];
        const model = req.headers['x-model'];
        if (typeof key !== 'string' || !key.trim()) throw new HttpError(400, 'Clé OpenRouter requise.');
        if (typeof model !== 'string') throw new HttpError(400, 'Modèle requis.');
        const result = await extractWithOpenRouter({ image: TEST_IMAGE, mimeType: 'image/png', section: 'tct', model, test: true }, key.trim());
        if (result?.ok !== true) throw new HttpError(502, 'Le moteur n’a pas confirmé la lecture de l’image.');
        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(error instanceof HttpError ? error.status : 502).json({
            error: error instanceof HttpError ? error.message : 'Le test a échoué. Réessayez.',
        });
    }
}
