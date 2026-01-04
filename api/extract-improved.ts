import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Improved Extract API with Security & Validation
 * - Rate limiting
 * - CORS restrictions
 * - Input validation
 * - Better error handling
 */

// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxRequests: number = 20, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (record.count >= maxRequests) {
        return false;
    }

    record.count++;
    return true;
}

// Allowed origins (restrict in production)
const ALLOWED_ORIGINS = [
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    'https://adt-taxi-coop.vercel.app',
    'https://adt-app.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
].filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. CORS Configuration (Restricted)
    const origin = req.headers.origin || '';
    const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed => origin.includes(allowed)) ||
                            process.env.NODE_ENV === 'development';

    if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Model');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle OPTIONS (Preflight) requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Security Validation
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 3. Rate Limiting
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const ipString = Array.isArray(clientIp) ? clientIp[0] : clientIp;

    if (!checkRateLimit(ipString)) {
        return res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.'
        });
    }

    // 4. Get configuration from headers
    const userApiKey = req.headers['x-api-key'] as string;
    const model = req.headers['x-model'] as string;

    // Fallback to env variable if header not provided
    const apiKey = userApiKey || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        console.error('CRITICAL: OpenRouter API key missing');
        return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    try {
        const { prompt, image, mimeType, systemInstruction, temperature, schema, responseMimeType } = req.body;

        // 5. Input Validation
        if (!prompt && !image) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Payload must contain prompt or image'
            });
        }

        // Validate image format
        if (image && mimeType) {
            const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!validMimeTypes.includes(mimeType)) {
                return res.status(400).json({
                    error: 'Invalid image type',
                    message: 'Only JPEG, PNG, and WebP images are supported'
                });
            }
        }

        // Validate temperature
        if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
            return res.status(400).json({
                error: 'Invalid temperature',
                message: 'Temperature must be between 0 and 2'
            });
        }

        const messages: any[] = [];

        // System message
        if (systemInstruction) {
            messages.push({
                role: 'system',
                content: systemInstruction
            });
        }

        // User message with image and/or text
        const userContent: any[] = [];
        if (prompt) {
            userContent.push({
                type: 'text',
                text: prompt
            });
        }
        if (image && mimeType) {
            userContent.push({
                type: 'image_url',
                image_url: {
                    url: `data:${mimeType};base64,${image}`
                }
            });
        }

        messages.push({
            role: 'user',
            content: userContent
        });

        const payload: any = {
            model: model || 'anthropic/claude-3.5-sonnet',
            messages: messages,
            temperature: temperature || 0.1,
        };

        // JSON mode for structured output
        if (responseMimeType === 'application/json' || schema) {
            payload.response_format = { type: 'json_object' };
        }

        // 6. API Call with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': origin || 'https://adt-taxi-coop.vercel.app',
                'X-Title': 'ADT - Extracteur de Données',
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenRouter API Error:', response.status, errorText);

            try {
                const errorJson = JSON.parse(errorText);
                return res.status(response.status).json({
                    error: errorJson.error?.message || response.statusText,
                    details: errorJson
                });
            } catch (e) {
                return res.status(response.status).json({
                    error: `OpenRouter API Error: ${response.statusText}`,
                    details: errorText
                });
            }
        }

        const data = await response.json();

        // Extract text from OpenRouter response
        const text = data.choices?.[0]?.message?.content || '';

        // 7. Log usage (for monitoring)
        console.log(`[${new Date().toISOString()}] API Call - IP: ${ipString}, Model: ${model || 'default'}, Success: ${!!text}`);

        return res.status(200).json({ text: text || "" });

    } catch (error: any) {
        console.error('Serverless Function Error:', error);

        if (error.name === 'AbortError') {
            return res.status(408).json({
                error: 'Request Timeout',
                message: 'The request took too long to complete'
            });
        }

        return res.status(500).json({
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
        });
    }
}
