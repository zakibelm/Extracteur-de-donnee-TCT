import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql } from './db';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log('API Request received:', req.url, req.method);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action, num_dome, id_employe, role } = req.body || {};
        console.log('Request body action:', action);

        if (!action || !num_dome || !id_employe) {
            console.log('Missing parameters');
            return res.status(400).json({ error: 'Missing parameters' });
        }

        const sql = getSql();

        if (action === 'signup') {
            console.log('Processing signup for:', num_dome);

            const existingUser = await sql`SELECT * FROM users WHERE num_dome = ${num_dome}`;
            if (existingUser.length > 0) {
                console.log('User already exists');
                return res.status(400).json({ error: 'Ce numéro de dôme est déjà enregistré.' });
            }

            console.log('Hashing password...');
            const hash = crypto.createHash('sha256').update(id_employe).digest('hex');

            console.log('Inserting user...');
            const result = await sql`
        INSERT INTO users (num_dome, id_employe, role, password_hash)
        VALUES (${num_dome}, ${id_employe}, ${role}, ${hash})
        RETURNING id, num_dome, role, created_at
      `;
            console.log('User inserted:', result[0]);

            return res.status(201).json({ user: result[0] });
        }

        if (action === 'login') {
            console.log('Processing login for:', num_dome);
            const hash = crypto.createHash('sha256').update(id_employe).digest('hex');

            const users = await sql`
        SELECT * FROM users 
        WHERE num_dome = ${num_dome} 
        AND password_hash = ${hash}
      `;

            if (users.length === 0) {
                console.log('Invalid credentials');
                return res.status(401).json({ error: 'Identifiants invalides.' });
            }

            console.log('Login successful');
            const user = users[0];
            return res.status(200).json({
                user: {
                    id: user.id,
                    num_dome: user.num_dome,
                    role: user.role,
                    created_at: user.created_at
                }
            });
        }

        return res.status(400).json({ error: 'Action invalide' });

    } catch (error: any) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: 'Erreur serveur interne',
            details: error.message
        });
    }
}
