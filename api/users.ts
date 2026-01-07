import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { eq, or } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'POST') {
        try {
            const { numDome, idEmploye, telephone, isAdmin } = req.body;

            if (!numDome || !idEmploye) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Check if user exists
            const existingUser = await db.select().from(users).where(eq(users.numDome, numDome)).execute();

            if (existingUser.length > 0) {
                // Update login timestamp or other fields if needed, for now just return
                return res.status(200).json(existingUser[0]);
            }

            // Create new user
            const newUser = await db.insert(users).values({
                numDome,
                idEmploye,
                telephone,
                isAdmin: isAdmin || false
            }).returning();

            return res.status(201).json(newUser[0]);

        } catch (error) {
            console.error('CRITICAL: User Auth Error:', error);
            if (error instanceof Error) {
                console.error('Stack:', error.stack);
                return res.status(500).json({ error: error.message, details: error.stack });
            }
            return res.status(500).json({ error: 'Internal Server Error', details: String(error) });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
