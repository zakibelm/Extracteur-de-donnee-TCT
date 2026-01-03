import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db';
import { extractions } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'DELETE') {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Missing ID' });
        }

        try {
            await db.delete(extractions).where(eq(extractions.id, id as string));
            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Delete Error:', error);
            return res.status(500).json({ error: 'Database error' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
