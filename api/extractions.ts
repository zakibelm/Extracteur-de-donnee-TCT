import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/index.js';
import { extractions } from '../src/db/schema.js';
import { eq, desc } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        // List extractions for a user
        const { userDome, section } = req.query;

        if (!userDome) {
            return res.status(400).json({ error: 'Missing userDome' });
        }

        try {
            let query = db.select().from(extractions).where(eq(extractions.userId, userDome as string));

            if (section) {
                // Add section filter if provided
                // query = query.where(eq(extractions.section, section as string)); 
                // Note: Chaining .where() in simple drizzle query builder might need proper "and" logic
                // Simplified:
                const results = await db.select().from(extractions)
                    .where(eq(extractions.userId, userDome as string))
                    .orderBy(desc(extractions.createdAt));

                if (section) {
                    return res.status(200).json(results.filter(r => r.section === section));
                }
                return res.status(200).json(results);
            }

            const history = await db.select().from(extractions)
                .where(eq(extractions.userId, userDome as string))
                .orderBy(desc(extractions.createdAt));

            return res.status(200).json(history);
        } catch (error) {
            console.error('Fetch History Error:', error);
            return res.status(500).json({ error: 'Database error' });
        }
    }

    if (req.method === 'POST') {
        // Save new extraction
        try {
            const { userId, section, fileName, status, content } = req.body;

            if (!userId || !fileName || !status) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const newRecord = await db.insert(extractions).values({
                userId,
                section,
                fileName,
                status,
                content
            }).returning();

            return res.status(201).json(newRecord[0]);
        } catch (error) {
            console.error('Save Extraction Error:', error);
            return res.status(500).json({ error: 'Database error' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
