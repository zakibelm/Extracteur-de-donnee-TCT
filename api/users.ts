import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { userSchema } from '../src/validation/schemas';
import { validateRequest, apiRateLimiter } from '../src/validation/middleware';

/**
 * Improved Users API with Security & Validation
 * - Rate limiting
 * - CORS restrictions
 * - Zod validation
 * - Better error handling
 */

const ALLOWED_ORIGINS = [
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    'https://adt-taxi-coop.vercel.app',
    'https://adt-app.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
].filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS (Restricted)
    const origin = req.headers.origin || '';
    const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed => origin.includes(allowed)) ||
                            process.env.NODE_ENV === 'development';

    if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Rate Limiting
    const clientIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown') as string;
    const ipString = Array.isArray(clientIp) ? clientIp[0] : clientIp;

    const rateLimit = apiRateLimiter.check(ipString);
    if (!rateLimit.allowed) {
        return res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.'
        });
    }

    if (req.method === 'POST') {
        try {
            // Validate input
            const validation = validateRequest(userSchema, req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validation.errors
                });
            }

            const { numDome, idEmploye, telephone, isAdmin } = validation.data!;

            // Check if user exists
            const existingUser = await db
                .select()
                .from(users)
                .where(eq(users.numDome, numDome))
                .execute();

            if (existingUser.length > 0) {
                // User exists, return existing user
                return res.status(200).json({
                    ...existingUser[0],
                    message: 'User authenticated successfully'
                });
            }

            // Create new user
            const newUser = await db
                .insert(users)
                .values({
                    numDome,
                    idEmploye,
                    telephone: telephone || null,
                    isAdmin: isAdmin || false
                })
                .returning();

            // Log successful user creation
            console.log(`[${new Date().toISOString()}] New user created - NumDome: ${numDome}, Admin: ${isAdmin}`);

            return res.status(201).json({
                ...newUser[0],
                message: 'User created successfully'
            });

        } catch (error: any) {
            console.error('User Auth Error:', error);

            // Check for specific DB errors
            if (error.code === '23505') { // Unique violation
                return res.status(409).json({
                    error: 'User already exists',
                    message: 'A user with this NumDome already exists'
                });
            }

            return res.status(500).json({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'development'
                    ? error.message
                    : 'Failed to process user authentication'
            });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
