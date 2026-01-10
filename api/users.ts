import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { numDome, idEmploye, telephone, email, isAdmin } = req.body;

        if (!numDome || !idEmploye) {
            return res.status(400).json({ error: 'numDome and idEmploye are required' });
        }

        // Check if user exists
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.numDome, numDome))
            .limit(1);

        if (existingUser.length > 0) {
            // User exists - login
            const user = existingUser[0];

            // Verify idEmploye matches
            if (user.idEmploye !== idEmploye) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            return res.status(200).json({
                success: true,
                user: {
                    numDome: user.numDome,
                    idEmploye: user.idEmploye,
                    telephone: user.telephone,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    createdAt: user.createdAt,
                },
            });
        } else {
            // User doesn't exist - create new user (signup)
            const newUser = await db
                .insert(users)
                .values({
                    numDome,
                    idEmploye,
                    telephone: telephone || null,
                    email: email || null,
                    isAdmin: isAdmin || false,
                })
                .returning();

            return res.status(201).json({
                success: true,
                user: {
                    numDome: newUser[0].numDome,
                    idEmploye: newUser[0].idEmploye,
                    telephone: newUser[0].telephone,
                    email: newUser[0].email,
                    isAdmin: newUser[0].isAdmin,
                    createdAt: newUser[0].createdAt,
                },
            });
        }
    } catch (error) {
        console.error('Error in users handler:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
