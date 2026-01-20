import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Fonction pour extraire le JSON de la réponse IA
function extractJSONFromText(text: string): any {
  // Essayer de trouver un bloc JSON avec regex
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse extracted JSON:', e);
    }
  }

  // Si pas de JSON trouvé, essayer de parser directement
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('No valid JSON found in AI response');
  }
}

// Fonction pour normaliser la réponse IA
function normalizeAIResponse(response: any): any {
  // Si c'est déjà au bon format
  if (response.phase && response.data) {
    return response;
  }

  // Format alternatif avec "tournees"
  if (response.tournees && Array.isArray(response.tournees)) {
    const normalized = {
      phase: "execute",
      data: response.tournees.map((item: any) => {
        const tour = item.tournee || item;
        return {
          "Tournée": tour.tournee || tour.Tournée || "",
          "Déb tour": tour.deb_tour || tour.debut_tour || tour["Déb tour"] || "",
          "Site": tour.site || tour.Site || "",
          "Cl véh": tour.cl_veh || tour.classe_vehicule || tour["Cl véh"] || "",
          "CDP 1": tour.cdp_1 || tour["CDP 1"] || "",
          "H Trav 1": tour.h_trav_1 || tour["H Trav 1"] || "",
          "CDP 2": tour.cdp_2 || tour["CDP 2"] || "",
          "H Trav 2": tour.h_trav_2 || tour["H Trav 2"] || ""
        };
      })
    };
    return normalized;
  }

  // Format tableau simple
  if (response.headers && response.rows) {
    return {
      phase: "execute",
      data: response.rows.map((row: any[]) => {
        const obj: any = {};
        response.headers.forEach((header: string, index: number) => {
          obj[header] = row[index];
        });
        return obj;
      })
    };
  }

  return response;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Model');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = req.headers['x-api-key'] as string;
    const model = req.headers['x-model'] as string || 'gpt-4-vision-preview';
    const { prompt, image, temperature = 0.1 } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Initialiser OpenAI avec la clé fournie
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: apiKey.startsWith('sk-or-') ? 'https://openrouter.ai/api/v1' : undefined
    });

    // Préparer le message
    const messages: any[] = [
      {
        role: 'user',
        content: image
          ? [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image } }
            ]
          : prompt
      }
    ];

    // Appel à l'API
    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: 4000
    });

    const aiResponse = completion.choices[0]?.message?.content || '';

    // Si c'est un test simple
    if (prompt.includes("Réponds seulement 'OK'")) {
      return res.status(200).json({
        success: true,
        response: aiResponse
      });
    }

    // Extraire et normaliser le JSON
    try {
      const extractedJSON = extractJSONFromText(aiResponse);
      const normalizedData = normalizeAIResponse(extractedJSON);

      return res.status(200).json({
        success: true,
        data: normalizedData,
        rawResponse: aiResponse
      });
    } catch (parseError: any) {
      console.error('JSON parsing error:', parseError);
      return res.status(200).json({
        success: false,
        error: 'Failed to parse AI response as JSON',
        rawResponse: aiResponse,
        details: parseError.message
      });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
      details: error.response?.data || error.stack
    });
  }
}
