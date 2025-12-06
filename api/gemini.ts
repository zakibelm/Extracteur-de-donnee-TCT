import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. CORS Configuration (Best Practice: Allow specific origins in prod, but keeping flexible for now)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OTA (Preflight) requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Security Validation
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('CRITICAL: GEMINI_API_KEY is missing in server environment variables.');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const { prompt, image, mimeType, systemInstruction, temperature, schema } = req.body;

        if (!prompt && !image) {
            return res.status(400).json({ error: 'Payload must contain prompt or image' });
        }

        // 3. Construct Google Gemini API Request
        // We use the REST API directly to avoid Node SDK dependency issues in edge/serverless environments if not strictly needed,
        // but here we are using standard fetch which is native.

        const modelParams = `?key=${apiKey}`;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent${modelParams}`;

        const parts: any[] = [];
        if (prompt) parts.push({ text: prompt });
        if (image && mimeType) {
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: image
                }
            });
        }

        const payload: any = {
            contents: [{ parts: parts }],
            generationConfig: {
                temperature: temperature || 0.1,
            }
        };

        if (systemInstruction) {
            payload.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        // Add Schema if provided (for strict JSON mode)
        if (schema) {
            payload.generationConfig.responseMimeType = "application/json";
            payload.generationConfig.responseSchema = schema;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API Error:', response.status, errorText);
            return res.status(response.status).json({ error: `Gemini API Error: ${response.statusText}`, details: errorText });
        }

        const data = await response.json();
        // Safety check on response structure
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return res.status(200).json({ text: text || "" });

    } catch (error) {
        console.error('Serverless Function Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
