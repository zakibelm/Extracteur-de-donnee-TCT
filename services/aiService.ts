
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
 * Extrait les données via OpenRouter API - FORMAT CSV SIMPLIFIÉ
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

    // Prompt CSV simplifié - BEAUCOUP plus simple que JSON !
    const systemPrompt = `Tu es un extracteur de données de tableaux logistiques.

TÂCHE: Extraire le tableau "Affectations des tournées" au format CSV.

FORMAT DE SORTIE (CSV uniquement, pas de JSON):
Tournée,Nom,Début tournée,Fin tournée,Classe véhicule,Employé,Nom de l'employé,Véhicule,Changement,Changement par,Classe véhicule affecté,Stationnement,Approuvé,Territoire début,Adresse de début,Adresse de fin
TCT0010,TAXI COOP TERREBONNE,6:30,7:25,TAXI,0458,Hammada Abdel Aziz,212,212,,TAXI,104,✓,104,3941 du Lias RUE,777 de Bois-de-Boulogne AV
TCT0027,TAXI COOP TERREBONNE,6:30,7:28,TAXI,0503,Daher Youssef,214,214,,MINIVAN,104,✓,104,2960 des Hirondelles RUE,1415 de l'Avenir CH

RÈGLES IMPORTANTES:
- Première ligne = en-têtes (exactement comme ci-dessus)
- Lignes suivantes = données du tableau
- Séparer les colonnes par des virgules
- Si une cellule contient une virgule, l'entourer de guillemets "..."
- Si une cellule est vide, laisser vide entre les virgules
- Extraire TOUTES les lignes visibles dans le tableau
- NE PAS ajouter de texte avant ou après le CSV
- NE PAS ajouter de notes ou commentaires

ATTENTION SPÉCIALE POUR LA COLONNE "Véhicule":
- La colonne "Véhicule" doit contenir le NUMÉRO du véhicule (exemple: 212, 214, 409, 111)
- PAS le nom de la personne ou du conducteur
- Cherche le numéro du véhicule dans le tableau, généralement une colonne avec des chiffres
- La colonne "Changement" doit contenir le MÊME numéro que "Véhicule"
- Exemple: si Véhicule=212, alors Changement=212

Juste le CSV pur`;

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
                        text: "Extrait le tableau au format CSV comme demandé. Réponds UNIQUEMENT avec le CSV, sans aucun texte supplémentaire."
                    },
                    {
                        type: "image_url",
                        image_url: { url: `data:${mimeType};base64,${base64Image}` }
                    }
                ]
            }
        ],
        temperature: 0.1,
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
    console.log('📝 Contenu CSV extrait:', text);

    if (!text || text.trim() === '') {
        throw new Error('Le modèle IA a retourné une réponse vide');
    }

    return parseCSVResponse(text);
}

/**
 * Parser CSV - BEAUCOUP plus simple que JSON !
 */
function parseCSVResponse(text: string): ParsedContent {
    try {
        // Nettoyer le texte
        let csvText = text.trim();

        // Supprimer les balises markdown si présentes
        if (csvText.startsWith('```csv') || csvText.startsWith('```')) {
            csvText = csvText.replace(/```csv\n?/g, '').replace(/```\n?/g, '').trim();
        }

        console.log('🔍 CSV reçu (200 premiers caractères):', csvText.substring(0, 200) + '...');

        // Séparer en lignes
        const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        if (lines.length < 2) {
            throw new Error('CSV invalide : moins de 2 lignes (en-têtes + données)');
        }

        console.log(`📊 ${lines.length} lignes trouvées (1 en-tête + ${lines.length - 1} données)`);

        // Parser chaque ligne CSV
        const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        // Extraire les données (ignorer la première ligne d'en-têtes)
        const dataLines = lines.slice(1);
        const rows: string[][] = dataLines.map(line => {
            const parsed = parseCSVLine(line);

            // S'assurer qu'on a le bon nombre de colonnes
            while (parsed.length < TABLE_HEADERS.length) {
                parsed.push('');
            }

            return parsed.slice(0, TABLE_HEADERS.length);
        });

        console.log('✅ Extraction CSV réussie:', rows.length, 'lignes');

        // Afficher un aperçu
        if (rows.length > 0) {
            console.log('📋 Première ligne:', rows[0].slice(0, 5).join(' | '));
        }

        return { headers: TABLE_HEADERS, rows };
    } catch (error) {
        console.error("❌ Erreur parsing CSV:", error);
        console.error("📝 Texte reçu:", text);
        throw new Error(`Le modèle IA n'a pas retourné un format CSV compatible: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
}
