import { getSql } from './db';

// Enable CORS
export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    try {
        const body = await req.json();
        const { action } = body;
        const sql = getSql();

        if (action === 'signup') {
            const { numDome, employeeId, email, password, accountType, telephone } = body;

            // Validate required fields
            if (!numDome || !employeeId || !email || !password || !accountType || !telephone) {
                return new Response(JSON.stringify({ error: 'Tous les champs sont requis' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Check if user exists (by email or employee_id)
            try {
                const existingUser = await sql`
                    SELECT * FROM users 
                    WHERE email = ${email} OR employee_id = ${employeeId}
                `;

                if (existingUser.length > 0) {
                    return new Response(JSON.stringify({ error: 'Un utilisateur avec cet email ou ID employé existe déjà' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                    });
                }
            } catch (err: any) {
                console.error('Error checking existing user:', err);
                // If column doesn't exist yet (migration lag?), might fail. But we ran migration.
            }

            // Simple hash placeholder (in production, use bcrypt/argon2)
            const hash = password;

            try {
                // Determine role based on accountType
                const role = accountType === 'admin' ? 'admin' : 'driver';

                const result = await sql`
                    INSERT INTO users (num_dome, employee_id, email, password_hash, role, telephone)
                    VALUES (${numDome}, ${employeeId}, ${email}, ${hash}, ${role}, ${telephone})
                    RETURNING id, num_dome, email, role, employee_id, created_at
                `;

                return new Response(JSON.stringify({
                    message: 'Utilisateur créé avec succès',
                    user: result[0]
                }), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            } catch (dbError: any) {
                console.error('Database error:', dbError);
                return new Response(JSON.stringify({ error: 'Erreur lors de la création de l\'utilisateur: ' + dbError.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

        } else if (action === 'login') {
            const { employeeId, password } = body;

            if (!employeeId || !password) {
                return new Response(JSON.stringify({ error: 'ID Employé et mot de passe requis' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Query by employee_id
            const users = await sql`
                SELECT * FROM users 
                WHERE employee_id = ${employeeId} 
                AND password_hash = ${password}
            `;

            if (users.length > 0) {
                const user = users[0];
                // Remove sensitive data
                const { password_hash, ...safeUser } = user;

                return new Response(JSON.stringify({
                    message: 'Connexion réussie',
                    user: safeUser
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            } else {
                return new Response(JSON.stringify({ error: 'Identifiants invalides' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }
        }

        return new Response(JSON.stringify({ error: 'Action non reconnue' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
