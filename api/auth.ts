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
        const { action, num_dome, password, email, accountType, telephone } = req.body || {};
        console.log('Request body action:', action);

        const sql = getSql();

        // ========== LOGIN ==========
        if (action === 'login') {
            if (!num_dome || !password) {
                console.log('Missing login parameters');
                return res.status(400).json({ error: 'ID et mot de passe requis' });
            }

            console.log('Processing login for:', num_dome);
            const hash = crypto.createHash('sha256').update(password).digest('hex');

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
                    numDome: user.num_dome,
                    email: user.email,
                    role: user.role,
                    isAdmin: user.role === 'admin',
                    created_at: user.created_at
                }
            });
        }

        // ========== SIGNUP ==========
        if (action === 'signup') {
            if (!email || !password) {
                console.log('Missing signup parameters');
                return res.status(400).json({ error: 'Email et mot de passe requis' });
            }

            console.log('Processing signup for:', email);

            // Check if email already exists
            const existingUser = await sql`SELECT * FROM users WHERE email = ${email}`;
            if (existingUser.length > 0) {
                console.log('Email already exists');
                return res.status(400).json({ error: 'Cet email est déjà enregistré.' });
            }

            // Generate a unique num_dome (ID) for the new user
            const generatedNumDome = `U${Date.now().toString(36).toUpperCase()}`;

            console.log('Hashing password...');
            const hash = crypto.createHash('sha256').update(password).digest('hex');

            const role = accountType || 'driver';

            console.log('Inserting user...');
            const result = await sql`
                INSERT INTO users (num_dome, email, role, password_hash, telephone)
                VALUES (${generatedNumDome}, ${email}, ${role}, ${hash}, ${telephone || null})
                RETURNING id, num_dome, email, role, created_at
            `;
            console.log('User inserted:', result[0]);

            const newUser = result[0];
            return res.status(201).json({
                user: {
                    id: newUser.id,
                    numDome: newUser.num_dome,
                    email: newUser.email,
                    role: newUser.role,
                    isAdmin: newUser.role === 'admin',
                    created_at: newUser.created_at
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
