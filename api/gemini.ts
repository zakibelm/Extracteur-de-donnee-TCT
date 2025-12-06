import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Allow only POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Securely get API key from server-side environment variable
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("API Key not found in environment variables");
        return res.status(500).json({ error: 'Server configuration error: API Key missing' });
    }

    try {
        const { prompt, image, mimeType, systemInstruction, temperature, schema } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Missing prompt' });
        }

        // Construct the payload for Google Gemini API
        const requestBody: any = {
            contents: [{
                parts: [
                    { text: prompt },
                    ...(image ? [{
                        inline_data: {
                            mime_type: mimeType || 'image/jpeg',
                            data: image
                        }
                    }] : [])
                ]
            }],
            generationConfig: {
                temperature: temperature || 0.1,
            }
        };

        if (systemInstruction) {
            requestBody.system_instruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        if (schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = schema;
        }

        // Call Google AI Studio directly via REST to avoid SDK issues in serverless (lighter)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error details:", JSON.stringify(data, null, 2));
            return res.status(response.status).json({ error: data.error?.message || 'Gemini API Error' });
        }

        // Standardize response extraction
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return res.status(200).json({ text: generatedText });

    } catch (error: any) {
        console.error('Serverless Function Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
