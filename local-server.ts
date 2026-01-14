import 'dotenv/config';
import dotenv from 'dotenv';
import fs from 'fs';

// Try loading .env.local if it exists (overrides .env)
if (fs.existsSync('.env.local')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

import express from 'express';
import cors from 'cors';
import usersHandler from './api/users';
import extractionsHandler from './api/extractions';
import deleteExtractionHandler from './api/extractions/[id]';
import { db } from './src/db';
import * as schema from './src/db/schema';
import { sql } from 'drizzle-orm';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { EnvSchema, validateOrThrow } from './src/validation/schemas';

// ========================================
// VALIDATION DES VARIABLES D'ENVIRONNEMENT
// ========================================
const env = validateOrThrow(
    EnvSchema,
    {
        DATABASE_URL: process.env.DATABASE_URL,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || '3002',
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3005',
        SESSION_SECRET: process.env.SESSION_SECRET,
        SENTRY_DSN: process.env.SENTRY_DSN || '',
        ENABLE_MOCK_MODE: process.env.ENABLE_MOCK_MODE || 'false',
        ENABLE_DEBUG_LOGS: process.env.ENABLE_DEBUG_LOGS || 'true',
    },
    '❌ Configuration environnement invalide'
);

const app = express();
const PORT = parseInt(env.PORT as string);

// ========================================
// SÉCURITÉ: CORS CONFIGURÉ CORRECTEMENT
// ========================================
const allowedOrigins = Array.isArray(env.ALLOWED_ORIGINS)
    ? env.ALLOWED_ORIGINS
    : [env.ALLOWED_ORIGINS as string];

app.use(cors({
    origin: (origin, callback) => {
        // Autorise les requêtes sans origin (Postman, curl, etc.) en dev
        if (!origin && env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        // Vérifie si l'origin est dans la liste autorisée
        if (origin && allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS: Origine refusée: ${origin}`);
            callback(new Error(`Origine non autorisée: ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // Cache preflight pendant 24h
}));

app.use(express.json({ limit: '50mb' }));

// Chrome Private Network Access headers
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    next();
});

// Logging Middleware (uniquement si ENABLE_DEBUG_LOGS est activé)
if (env.ENABLE_DEBUG_LOGS) {
    app.use((req, res, next) => {
        console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        const bodyStr = req.body ? JSON.stringify(req.body) : 'No body';
        console.log('Body:', bodyStr.slice(0, 200) + (bodyStr.length > 200 ? '...' : ''));
        next();
    });
}

// DB Status Flag
let isDbConnected = !env.ENABLE_MOCK_MODE;

// Test DB Connection on Start
(async () => {
    if (env.ENABLE_MOCK_MODE) {
        console.warn("⚠️ MOCK MODE ENABLED: Skipping DB connection");
        isDbConnected = false;
        return;
    }

    try {
        console.log("Testing DB connection...");
        const result = await db.select({ count: sql`count(*)` }).from(schema.users);
        console.log("✅ DB Connection successful. User count:", result[0]?.count);
        isDbConnected = true;
    } catch (e) {
        console.error("❌ DB Connection Failed:", e);
        console.warn("⚠️ FALLING BACK TO MOCK MODE: requests will bypass DB");
        isDbConnected = false;
    }
})();

// Adapter to convert Express req/res to Vercel req/res
const adapter = (handler: (req: VercelRequest, res: VercelResponse) => Promise<any>) => {
    return async (req: express.Request, res: express.Response) => {
        // CIRCUIT BREAKER: If DB is down, serve mock data immediately
        if (!isDbConnected) {
            console.log(`[MOCK MODE] Intercepting ${req.method} ${req.url}`);

            if (req.originalUrl.includes('users') || req.url.includes('users')) {
                const body = req.body || {};
                const mockUser = {
                    numDome: body.numDome || 'MOCK',
                    idEmploye: body.idEmploye || 'MOCK_USER',
                    isAdmin: body.isAdmin || false,
                    telephone: body.telephone || '',
                    createdAt: new Date().toISOString()
                };
                return res.status(200).json(mockUser);
            }

            if ((req.originalUrl.includes('extractions') || req.url.includes('extractions')) && req.method === 'GET') {
                return res.status(200).json([]);
            }

            // For other endpoints in mock mode, return success or empty
            return res.status(200).json({ message: "Mock Success" });
        }

        try {
            console.log('[ADAPTER] Calling handler for:', req.url);
            await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
            console.log('[ADAPTER] Handler completed successfully');
        } catch (e) {
            console.error('[ADAPTER] Handler Error:', e);
            console.error('[ADAPTER] Stack:', e instanceof Error ? e.stack : 'No stack');
            // Fallback just in case
            if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: String(e) });
        }
    };
};

// Simple test endpoint
app.get('/api/test', (req, res) => {
    console.log('✅ TEST ENDPOINT HIT!');
    res.json({ status: 'ok', message: 'Server is working!' });
});

// Routes
// We use 'all' to let the handler decide based on method, matching Vercel function behavior
app.all('/api/users', adapter(usersHandler));
app.all('/api/extractions', adapter(extractionsHandler));
app.all('/api/extractions/:id', adapter(deleteExtractionHandler));

app.listen(PORT, () => {
    console.log(`✅ Local API Server running on http://localhost:${PORT}`);

    // Keep process alive just in case
    setInterval(() => {
        // no-op to keep event loop active if express fails to?
    }, 10000);
});
