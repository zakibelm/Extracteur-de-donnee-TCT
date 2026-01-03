import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Configuration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Model');

    // Handle OPTIONS (Preflight) requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Security Validation
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get configuration from headers
    const userApiKey = req.headers['x-api-key'] as string;
    const model = req.headers['x-model'] as string;

    // Fallback to env variable if header not provided
    const apiKey = userApiKey || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        console.error('CRITICAL: OpenRouter API key missing');
        return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    try {
        const { prompt, image, mimeType, systemInstruction, temperature, schema, responseMimeType } = req.body;

        if (!prompt && !image) {
            return res.status(400).json({ error: 'Payload must contain prompt or image' });
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

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://adt-taxi-coop.vercel.app',
                'X-Title': 'ADT - Extracteur de Données',
            },
            body: JSON.stringify(payload)
        });

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

        return res.status(200).json({ text: text || "" });

    } catch (error: any) {
        console.error('Serverless Function Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
