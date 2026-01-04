import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db';
import { extractions } from '../src/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { saveExtractionSchema } from '../src/validation/schemas';
import { validateRequest, apiRateLimiter } from '../src/validation/middleware';

/**
 * Improved Extractions API with Security & Validation
 * - Rate limiting
 * - CORS restrictions
 * - Zod validation
 * - Better error handling
 * - Query optimization
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

    if (req.method === 'GET') {
        try {
            const { userDome, section } = req.query;

            // Validate required parameters
            if (!userDome || typeof userDome !== 'string') {
                return res.status(400).json({
                    error: 'Missing or invalid userDome parameter'
                });
            }

            // Validate section if provided
            if (section && !['tct', 'olymel'].includes(section as string)) {
                return res.status(400).json({
                    error: 'Invalid section parameter',
                    message: 'Section must be either "tct" or "olymel"'
                });
            }

            // Build query with proper filtering
            let query = db
                .select()
                .from(extractions)
                .where(eq(extractions.userId, userDome))
                .orderBy(desc(extractions.createdAt));

            const results = await query.execute();

            // Filter by section if provided (client-side for simplicity)
            const filtered = section
                ? results.filter(r => r.section === section)
                : results;

            // Log the query for monitoring
            console.log(`[${new Date().toISOString()}] Extractions fetched - User: ${userDome}, Section: ${section || 'all'}, Count: ${filtered.length}`);

            return res.status(200).json(filtered);

        } catch (error: any) {
            console.error('Fetch Extractions Error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: process.env.NODE_ENV === 'development'
                    ? error.message
                    : 'Failed to fetch extractions'
            });
        }
    }

    if (req.method === 'POST') {
        try {
            // Validate input
            const validation = validateRequest(saveExtractionSchema, req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validation.errors
                });
            }

            const { userId, section, fileName, status, content } = validation.data!;

            // Insert into database
            const newRecord = await db
                .insert(extractions)
                .values({
                    userId,
                    section,
                    fileName,
                    status,
                    content
                })
                .returning();

            // Log successful save
            console.log(`[${new Date().toISOString()}] Extraction saved - User: ${userId}, Section: ${section}, File: ${fileName}`);

            return res.status(201).json({
                ...newRecord[0],
                message: 'Extraction saved successfully'
            });

        } catch (error: any) {
            console.error('Save Extraction Error:', error);

            // Check for specific DB errors
            if (error.code === '23503') { // Foreign key violation
                return res.status(400).json({
                    error: 'Invalid user',
                    message: 'User does not exist'
                });
            }

            return res.status(500).json({
                error: 'Database error',
                message: process.env.NODE_ENV === 'development'
                    ? error.message
                    : 'Failed to save extraction'
            });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
