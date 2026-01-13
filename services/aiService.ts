import { ParsedContent, TABLE_HEADERS, AISettings } from '../types';
import { convertAIResponseToSQL, RowWithCoordinates } from './coordinateValidator';

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
 * Extrait les données via OpenRouter API - MODE MATRICE STRICTE
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

    // Prompt JSON Matriciel - Validation Stricte des Positions
    const systemPrompt = `Tu es un extracteur de données logistiques de HAUTE PRÉCISION.

 ta mission est de scanner le tableau et de retourner un objet JSON structuré avec les COORDONNÉES EXACTES de chaque cellule.

STRUCTURE JSON ATTENDUE:
{
  "phase": "extraction_matricielle",
  "rows": [
    {
      "row_number": 1,
      "y_position": 135,
      "cells_by_position": {
        "1": { "position": 1, "header": "Tournée", "value": "TCT0010" },
        "2": { "position": 2, "header": "Nom", "value": "TAXI COOP TERREBONNE" },
        "3": { "position": 3, "header": "Déb tour", "value": "6:30" },
        "4": { "position": 4, "header": "Fin tour", "value": "7:25" },
        "5": { "position": 5, "header": "Classe véhicule", "value": "TAXI" },
        "6": { "position": 6, "header": "Employé", "value": "0458" },
        "7": { "position": 7, "header": "Nom de l'employé", "value": "Hammada Abdel Aziz" },
        "8": { "position": 8, "header": "Employé", "value": "" },
        "9": { "position": 9, "header": "Véhicule", "value": "212" },
        "10": { "position": 10, "header": "Classe véhicule affecté", "value": "TAXI" },
        "11": { "position": 11, "header": "Autorisation", "value": "" },
        "12": { "position": 12, "header": "Approuvé", "value": "✓" },
        "13": { "position": 13, "header": "Retour", "value": "" },
        "14": { "position": 14, "header": "Territoire début", "value": "104" },
        "15": { "position": 15, "header": "Adresse de début", "value": "3941 du Lias RUE" },
        "16": { "position": 16, "header": "Adresse de fin", "value": "777 de Bois-de-Boulogne AV" },
        "17": { "position": 17, "header": "Changement", "value": "" }
      }
    }
  ]
}

RÈGLES CRITIQUES:
1. Scan chaque ligne visuelle du tableau.
2. Pour CHAQUE ligne, identifie les 17 colonnes.
3. Si une cellule est VIDE, retourne "value": "".
4. "header" doit être le texte exact de l'en-tête de cette colonne.
5. "position" doit correspondre STRICTEMENT à l'ordre des colonnes (1 à 17).
6. "value" doit être le contenu brut de la cellule.
7. NE JAMAIS inventer de données. Donne exactement ce que tu vois.

Retourne UNIQUEMENT le JSON.`;

    const payload = {
        model: settings.modelId,
        response_format: { type: "json_object" },
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
                        text: "Analyse ce tableau et retourne la matrice JSON complète avec les coordonnées."
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

    console.log('🔍 Envoi requête Matricielle à OpenRouter:', {
        model: settings.modelId,
        imageSize: base64Image.length
    });

    try {
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

        if (!result.choices || !result.choices[0] || !result.choices[0].message) {
            throw new Error('Réponse vide ou invalide de l\'IA');
        }

        const jsonContent = result.choices[0].message.content;
        console.log('📥 JSON reçu:', jsonContent.substring(0, 200) + '...');

        // Parser le JSON
        let aiData;
        try {
            aiData = JSON.parse(jsonContent);
        } catch (e) {
            console.error("Erreur parsing JSON:", e);
            throw new Error("L'IA n'a pas retourné un JSON valide.");
        }

        // Valider et convertir avec le validateur strict
        const validationResult = convertAIResponseToSQL(aiData);

        if (!validationResult.success) {
            console.error("❌ Validation échouée:", validationResult.errors);
            throw new Error(`Validation échouée pour ${validationResult.errors.length} lignes. Voir console.`);
        }

        console.log(`✅ ${validationResult.validRows.length} lignes validées avec succès.`);

        // Convertir les données validées en format tableau pour l'UI
        // On mappe les clés SQL du validateur aux index de TABLE_HEADERS
        const uiRows = validationResult.validRows.map(row => {
            // Mapping Validator Keys -> UI Array Index
            // TABLE_HEADERS: [
            // 0: "Tournée", 1: "Nom", 2: "Début tournée", 3: "Fin tournée", 4: "Classe véhicule", 
            // 5: "Employé", 6: "Nom de l'employé", 7: "Véhicule", 8: "Changement", 9: "Changement par",
            // 10: "Classe véhicule affecté", 11: "Stationnement", 12: "Approuvé", 13: "Territoire début",
            // 14: "Adresse de début", 15: "Adresse de fin"
            // ]

            return [
                row.tournee || '',                  // 0: Tournée
                row.nom_compagnie || '',            // 1: Nom
                row.debut_tournee || '',            // 2: Début tournée
                row.fin_tournee || '',              // 3: Fin tournée
                row.classe_vehicule || '',          // 4: Classe véhicule
                row.id_employe || '',               // 5: Employé
                row.nom_employe_complet || '',      // 6: Nom de l'employé
                row.vehicule || '',                 // 7: Véhicule
                row.changement || '',               // 8: Changement
                row.changement_par || '',           // 9: Changement par
                row.classe_vehicule_affecte || '',  // 10: Classe véhicule affecté
                row.autorisation || '',             // 11: Stationnement (Map Autoris -> Stationnement?? A vérifier)
                row.approuve || '',                 // 12: Approuvé
                row.retour || '',                   // 13: Territoire début (Retour?? Non, Pos 14 est adresse debut...)
                row.adresse_debut || '',            // 14: Adresse de début (UI: 14)
                row.adresse_fin || ''               // 15: Adresse de fin (UI: 15)
            ];
        });

        const finalRows = uiRows.map(row => row.map(val => String(val)));

        return {
            headers: TABLE_HEADERS,
            rows: finalRows
        };

    } catch (error) {
        console.error("❌ Erreur critique extractDataFromImage:", error);
        throw error;
    }
}
