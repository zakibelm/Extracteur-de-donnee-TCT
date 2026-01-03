import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. CORS Configuration
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

    const { apiKey: customApiKey, model: customModel, prompt, image, mimeType, systemInstruction, temperature, schema, responseMimeType } = req.body;

    // Use custom key if provided, otherwise fallback to server env
    const effectiveApiKey = customApiKey || process.env.GEMINI_API_KEY;

    if (!effectiveApiKey) {
        console.error('CRITICAL: GEMINI_API_KEY is missing in server environment variables and no custom key provided.');
        return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    try {
        if (!prompt && !image) {
            return res.status(400).json({ error: 'Payload must contain prompt or image' });
        }

        // 3. Construct API Request (OpenRouter or Google)
        const isOpenRouter = effectiveApiKey.startsWith('sk-or-');
        const baseUrl = isOpenRouter
            ? 'https://openrouter.ai/api/v1/chat/completions'
            : 'https://generativelanguage.googleapis.com/v1beta/models';

        let url = '';
        let payload: any = {};
        let fetchOptions: any = {};

        if (isOpenRouter) {
            // OPENROUTER (OpenAI Compatible)
            url = baseUrl;

            // Model Mapping/Selection
            const modelId = customModel && customModel !== 'google-gemini-2.0-flash-free' ? customModel : 'google/gemini-2.0-flash-exp:free';

            const messages: any[] = [];
            if (systemInstruction) {
                messages.push({ role: "system", content: systemInstruction });
            }

            const userContent: any[] = [];
            if (prompt) userContent.push({ type: "text", text: prompt });
            if (image && mimeType) {
                userContent.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } });
            }
            messages.push({ role: "user", content: userContent });

            payload = {
                model: modelId,
                messages: messages,
                temperature: temperature || 0.1,
                response_format: schema ? { type: "json_object" } : undefined
                // Note: OpenRouter 'json_object' support depends on the underlying model.
            };

            fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${effectiveApiKey}`,
                    'HTTP-Referer': 'https://adt-app.vercel.app',
                    'X-Title': 'ADT App'
                },
                body: JSON.stringify(payload)
            };

        } else {
            // GOOGLE NATIVE
            const modelName = customModel && customModel.startsWith('gemini') ? customModel : 'gemini-2.0-flash-exp';
            const modelParams = `?key=${effectiveApiKey}`;
            url = `${baseUrl}/${modelName}:generateContent${modelParams}`;

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

            payload = {
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

            if (schema) {
                payload.generationConfig.responseMimeType = "application/json";
                payload.generationConfig.responseSchema = schema;
            } else if (responseMimeType) {
                payload.generationConfig.responseMimeType = responseMimeType;
            }

            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            };
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            try {
                const errorJson = JSON.parse(errorText);
                return res.status(response.status).json({
                    error: errorJson.error?.message || response.statusText,
                    details: errorJson
                });
            } catch (e) {
                return res.status(response.status).json({ error: `API Error: ${response.statusText}`, details: errorText });
            }
        }

        const data = await response.json();
        let text = "";

        if (isOpenRouter) {
            // OpenRouter/OpenAI response structure
            text = data.choices?.[0]?.message?.content || "";
        } else {
            // Google Gemini response structure
            text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }

        return res.status(200).json({ text });

    } catch (error: any) {
        console.error('Serverless Function Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
