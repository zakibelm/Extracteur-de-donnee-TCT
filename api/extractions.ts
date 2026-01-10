import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db';
import { extractions } from '../src/db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            // Get all extractions or filter by userDome
            const { userDome } = req.query;

            let query = db.select().from(extractions);

            if (userDome && typeof userDome === 'string') {
                query = query.where(eq(extractions.userDome, userDome));
            }

            const results = await query;
            return res.status(200).json({ success: true, extractions: results });
        }

        if (req.method === 'POST') {
            // Create new extraction
            const { userDome, section, fileName, status, content } = req.body;

            if (!userDome || !section) {
                return res.status(400).json({ error: 'userDome and section are required' });
            }

            const newExtraction = await db
                .insert(extractions)
                .values({
                    userDome,
                    section,
                    fileName: fileName || null,
                    status: status || 'pending',
                    content: content || null,
                })
                .returning();

            return res.status(201).json({
                success: true,
                extraction: newExtraction[0],
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Error in extractions handler:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
