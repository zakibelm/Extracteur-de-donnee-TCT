
import { ParsedContent, TABLE_HEADERS, AISettings } from '../types';

/**
 * Optimise une image pour l'envoi au moteur IA
 */
export async function optimizeImage(file: File): Promise<{ base64: string, mimeType: string }> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 2048;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve({
                    base64: dataUrl.split(',')[1],
                    mimeType: 'image/jpeg'
                });
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Teste la validité de la clé OpenRouter
 */
export async function validateOpenRouterKey(key: string): Promise<boolean> {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${key}` }
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Extrait les données via OpenRouter API
 */
export async function extractDataFromImage(
    base64Image: string,
    mimeType: string,
    settings: AISettings
): Promise<ParsedContent> {
    if (!settings.openRouterKey) {
        throw new Error("Clé API OpenRouter requise. Veuillez configurer votre clé dans les paramètres.");
    }

    const url = 'https://openrouter.ai/api/v1/chat/completions';

    // Note: Certains modèles OpenRouter préfèrent le format JSON via le prompt plutôt que via response_format
    const payload = {
        model: settings.modelId,
        messages: [
            {
                role: "system",
                content: `${settings.systemPrompt}\n\nIMPORTANT: Réponds uniquement avec un objet JSON valide contenant une clé 'entries'.`
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "Analyse ce document logistique et extrait le tableau des tournées." },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                ]
            }
        ],
        response_format: { type: "json_object" }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.openRouterKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'ADT Logistics AI'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Erreur OpenRouter (${response.status}): ${errBody}`);
    }

    const result = await response.json();
    const text = result.choices[0].message.content;
    return parseAIResponse(text);
}

/**
 * Helper polyvalent pour parser les réponses JSON des différents modèles
 */
function parseAIResponse(text: string): ParsedContent {
    try {
        // Nettoyage du texte au cas où le modèle ajoute des balises ```json
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(jsonStr);

        // Extraction intelligente des données selon la structure retournée
        let entries: any[] = [];

        if (parsedData.entries && Array.isArray(parsedData.entries)) {
            entries = parsedData.entries;
        } else if (Array.isArray(parsedData)) {
            entries = parsedData;
        } else {
            // Cherche le premier tableau trouvé dans l'objet
            const firstArray = Object.values(parsedData).find(v => Array.isArray(v));
            if (Array.isArray(firstArray)) {
                entries = firstArray;
            }
        }

        const rows: string[][] = entries.map((entry: any) =>
            TABLE_HEADERS.map(h => {
                const val = entry[h] !== undefined ? entry[h] : entry[h.toLowerCase()];
                return val !== undefined && val !== null ? String(val) : '';
            })
        );

        return { headers: TABLE_HEADERS, rows };
    } catch (error) {
        console.error("AI Parsing Error:", error, "Text was:", text);
        throw new Error("Le modèle IA n'a pas retourné un format JSON compatible.");
    }
}
