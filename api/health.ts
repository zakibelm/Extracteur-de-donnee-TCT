import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db';

/**
 * Health Check Endpoint
 * Tests database connectivity and API status
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS for health checks
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        const startTime = Date.now();
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: {
                status: 'unknown',
                responseTime: 0
            },
            api: {
                version: '2.0.0',
                environment: process.env.NODE_ENV || 'production'
            }
        };

        try {
            // Test database connection
            const dbStartTime = Date.now();
            await db.execute({ sql: 'SELECT 1' });
            const dbEndTime = Date.now();

            health.database.status = 'connected';
            health.database.responseTime = dbEndTime - dbStartTime;

            const totalTime = Date.now() - startTime;

            return res.status(200).json({
                ...health,
                responseTime: totalTime,
                message: 'All systems operational'
            });

        } catch (error: any) {
            health.status = 'degraded';
            health.database.status = 'error';

            console.error('Health Check Failed:', error);

            return res.status(503).json({
                ...health,
                error: 'Database connection failed',
                message: process.env.NODE_ENV === 'development'
                    ? error.message
                    : 'Service temporarily unavailable'
            });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
