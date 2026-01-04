import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db';
import { extractions } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { apiRateLimiter } from '../../src/validation/middleware';

/**
 * Improved Delete Extraction Endpoint
 * - Rate limiting
 * - CORS restrictions
 * - Better error handling
 * - Validation
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

    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
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

    if (req.method === 'DELETE') {
        const { id } = req.query;

        // Validate ID
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                error: 'Missing or invalid ID',
                message: 'Extraction ID is required'
            });
        }

        try {
            // Check if extraction exists
            const existing = await db
                .select()
                .from(extractions)
                .where(eq(extractions.id, id))
                .execute();

            if (existing.length === 0) {
                return res.status(404).json({
                    error: 'Not found',
                    message: 'Extraction not found'
                });
            }

            // Delete the extraction
            await db
                .delete(extractions)
                .where(eq(extractions.id, id))
                .execute();

            // Log successful deletion
            console.log(`[${new Date().toISOString()}] Extraction deleted - ID: ${id}`);

            return res.status(200).json({
                success: true,
                message: 'Extraction deleted successfully'
            });

        } catch (error: any) {
            console.error('Delete Error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: process.env.NODE_ENV === 'development'
                    ? error.message
                    : 'Failed to delete extraction'
            });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
