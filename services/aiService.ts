
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

    // Prompt optimisé pour Claude Sonnet et autres VLLMs
    const systemPrompt = `Tu es un expert en extraction de données de documents logistiques.

TÂCHE: Extraire le tableau "Affectations des tournées" de l'image fournie.

FORMAT DE SORTIE REQUIS:
{
  "entries": [
    {
      "Tournée": "valeur",
      "Nom": "valeur",
      "Début tournée": "valeur",
      "Fin tournée": "valeur",
      "Classe véhicule": "valeur",
      "Employé": "valeur",
      "Nom de l'employé": "valeur",
      "Véhicule": "valeur",
      "Classe véhicule affecté": "valeur",
      "Stationnement": "valeur",
      "Approuvé": "valeur",
      "Territoire début": "valeur",
      "Adresse de début": "valeur",
      "Adresse de fin": "valeur"
    }
  ]
}

RÈGLES:
- Réponds UNIQUEMENT avec du JSON valide
- Chaque ligne du tableau = un objet dans "entries"
- Si une colonne est vide, utilise une chaîne vide ""
- Ne pas inventer de données
- Respecter exactement les noms de colonnes ci-dessus`;

    const payload = {
        model: settings.modelId,
        messages: [
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Analyse ce document et extrait le tableau des tournées au format JSON demandé."
                    },
                    {
                        type: "image_url",
                        image_url: { url: `data:${mimeType};base64,${base64Image}` }
                    }
                ]
            }
        ],
        temperature: 0.1, // Bas pour plus de précision
        max_tokens: 4000
    };

    console.log('🔍 Envoi requête à OpenRouter:', {
        model: settings.modelId,
        imageSize: base64Image.length,
        mimeType
    });

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
        console.error('❌ Erreur OpenRouter:', response.status, errBody);
        throw new Error(`Erreur OpenRouter (${response.status}): ${errBody}`);
    }

    const result = await response.json();
    console.log('📥 Réponse OpenRouter:', result);

    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        console.error('❌ Format de réponse invalide:', result);
        throw new Error('Format de réponse OpenRouter invalide');
    }

    const text = result.choices[0].message.content;
    console.log('📝 Contenu extrait:', text);

    if (!text || text.trim() === '') {
        throw new Error('Le modèle IA a retourné une réponse vide');
    }

    return parseAIResponse(text);
}

/**
 * Helper polyvalent pour parser les réponses JSON des différents modèles
 */
function parseAIResponse(text: string): ParsedContent {
    try {
        // Nettoyage du texte au cas où le modèle ajoute des balises ```json
        let jsonStr = text.trim();

        // Supprimer les balises markdown
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```\n?/g, '');
        }

        jsonStr = jsonStr.trim();

        console.log('🔍 JSON à parser:', jsonStr.substring(0, 200) + '...');

        const parsedData = JSON.parse(jsonStr);
        console.log('✅ JSON parsé:', parsedData);

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

        console.log(`📊 ${entries.length} entrées trouvées`);

        if (entries.length === 0) {
            throw new Error('Aucune donnée extraite du tableau');
        }

        const rows: string[][] = entries.map((entry: any) =>
            TABLE_HEADERS.map(h => {
                const val = entry[h] !== undefined ? entry[h] : entry[h.toLowerCase()];
                return val !== undefined && val !== null ? String(val) : '';
            })
        );

        console.log('✅ Extraction réussie:', rows.length, 'lignes');
        return { headers: TABLE_HEADERS, rows };
    } catch (error) {
        console.error("❌ Erreur parsing AI:", error);
        console.error("📝 Texte reçu:", text);
        throw new Error(`Le modèle IA n'a pas retourné un format JSON compatible: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
}
