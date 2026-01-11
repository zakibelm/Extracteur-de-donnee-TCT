import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './db';

// Simple in-memory hashing for demo purposes (replace with bcrypt in production)
// Note: In a real app, use bcryptjs. Since we are in a serverless function, ensure dependencies are present.
// For now, we'll store plain text or simple hash to avoid dependency hell if bcrypt isn't installed, 
// BUT the plan said 'password_hash', so we'll simulate.
// actually, let's try to use crypto since it's built-in to Node
import crypto from 'crypto';

const hashPassword = (password: string) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, numDome, idEmploye, accountType } = req.body;

    try {
        if (action === 'signup') {
            // Check if user exists
            const check = await pool.query('SELECT id FROM users WHERE num_dome = $1', [numDome]);
            if (check.rows.length > 0) {
                return res.status(400).json({ error: 'Ce numéro de dôme est déjà enregistré.' });
            }

            // Create user
            // Using idEmploye as password for simplicity in this MVP flow, hashed
            const passwordHash = hashPassword(idEmploye);

            // Determine role based on client logic (or override here for security)
            // Client sent 'admin' or 'driver'. trust for now in MVP
            const role = accountType === 'admin' ? 'admin' : 'driver';

            const result = await pool.query(
                'INSERT INTO users (num_dome, id_employe, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, num_dome, role, created_at',
                [numDome, idEmploye, passwordHash, role]
            );

            return res.status(201).json({ user: result.rows[0], message: 'Compte créé avec succès' });
        }

        else if (action === 'login') {
            const result = await pool.query('SELECT * FROM users WHERE num_dome = $1', [numDome]);

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Utilisateur non trouvé.' });
            }

            const user = result.rows[0];
            const inputHash = hashPassword(idEmploye);

            if (inputHash !== user.password_hash) {
                return res.status(401).json({ error: 'Identifiant incorrect.' });
            }

            // Return user info (excluding hash)
            return res.status(200).json({
                user: {
                    id: user.id,
                    numDome: user.num_dome,
                    idEmploye: user.id_employe,
                    isAdmin: user.role === 'admin',
                    role: user.role
                }
            });
        }

        return res.status(400).json({ error: 'Action non reconnue' });

    } catch (error: any) {
        console.error('Database Error:', error);
        return res.status(500).json({ error: 'Erreur serveur base de données', details: error.message });
    }
}
