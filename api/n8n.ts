import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, HttpError } from '../server/auth';
import { validateTable, TCT_HEADERS } from '../src/utils/table';

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
        if (!webhook || !secret || new URL(webhook).protocol !== 'https:') {
            throw new HttpError(503, 'Extraction serveur non configurée.');
        }
        const response = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': secret },
            body: JSON.stringify({ image, section, mimeType, user_id: user.id,
                user_dome: user.user_metadata?.numDome || '', timestamp: new Date().toISOString() }),
            signal: AbortSignal.timeout(110_000),
            redirect: 'error',
        });
        if (!response.ok) throw new HttpError(502, 'Service extraction indisponible. Réessayez.');
        const raw = await response.json();
        let result;
        try { result = validateTable(raw, section === 'tct' ? TCT_HEADERS : undefined); }
        catch { throw new HttpError(502, 'Le service a retourné un tableau mal aligné.'); }
        return res.status(200).json(result);
    } catch (error) {
        return res.status(error instanceof HttpError ? error.status : 502).json({
            error: error instanceof HttpError ? error.message : 'Échec extraction. Réessayez.',
        });
    }
}
