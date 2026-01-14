import { ParsedContent, TABLE_HEADERS, AISettings } from '../types';
import { validateAndConvertAIResponse, debugLogRow, AIResponse } from './cellByCellValidator';

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
 * Extrait les données via OpenRouter API - MODE CELL-BY-CELL STRICT
 */
export async function extractDataFromImage(
    base64Image: string,
    mimeType: string,
    settings: AISettings
): Promise<ParsedContent> {
    console.log("%c 🚀 AI SERVICE v3: CELL-BY-CELL ACTIVE 🚀", "color: #00ff00; font-weight: bold; font-size: 20px; background: #000; padding: 10px; border-radius: 5px;");

    if (!settings.openRouterKey) {
        throw new Error("Clé API OpenRouter requise. Veuillez configurer votre clé dans les paramètres.");
    }

    const url = 'https://openrouter.ai/api/v1/chat/completions';

    // Prompt JSON "Cell-by-Cell" - Extraction par ligne + en-tête
    const systemPrompt = `Tu es un extracteur de données logistiques de HAUTE PRÉCISION.

TA MISSION:
1. Analyse l'image du tableau de tournées.
2. Identifie TOUS les en-têtes de colonnes (environ 15 à 17).
3. Pour CHAQUE ligne de donnée, extrais la valeur correspondant à CHAQUE en-tête.

STRUCTURE JSON ATTENDUE:
{
  "phase": "execute",
  "headers_detected": [
    "Tournée", "Nom", "Déb tour", "Fin tour", "Cl véh",
    "Employé", "Nom de l'employé", "Employé", "Véhicule",
    "Cl véh aff", "Autoris", "Approuvé", "Retour",
    "Adresse de début", "Adresse de fin"
  ],
  "total_headers": 15,
  "data": [
    {
      "row_number": 1,
      "cells": [
        { "column_header": "Tournée", "value": "..." },
        { "column_header": "Nom", "value": "..." },
        // ... UNE CELLULE POUR CHAQUE HEADER DÉTECTÉ
      ]
    }
  ]
}

RÈGLES CRITIQUES:
1. SI UNE COLONNE (ex: "Autoris", "Retour") EST VIDE DANS LE TABLEAU, CRÉE QUAND MÊME LA CELLULE AVEC "value": "".
2. SI UNE COLONNE "Employé" APPARAÎT 2 FOIS, CRÉE 2 CELLULES AVEC LE HEADER "Employé" À LEUR POSITION RESPECTIVE.
3. NE SAUTE AUCUNE COLONNE. Si "headers_detected" a 15 éléments, chaque ligne DOIT avoir 15 cellules.
4. Associe STRICTEMENT la valeur visuelle à son en-tête vertical. Ne décalle jamais.
5. "value" doit être le contenu brut exact (OCR).

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
                        text: "Extrait ce tableau cellule par cellule en respectant scrupuleusement les en-têtes."
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

    console.log('🔍 Envoi requête Cell-by-Cell à OpenRouter:', {
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
        let aiData: AIResponse;
        try {
            aiData = JSON.parse(jsonContent);
        } catch (e) {
            console.error("Erreur parsing JSON:", e);
            throw new Error("L'IA n'a pas retourné un JSON valide.");
        }

        // Logger pour debug
        if (aiData.data && aiData.data.length > 0) {
            debugLogRow(aiData.data[0], aiData.headers_detected);
        }

        // Valider et convertir avec le validateur Cell-by-Cell
        const validationResult = validateAndConvertAIResponse(aiData);

        if (!validationResult.success) {
            console.error("❌ Validation échouée:", validationResult.errors);
            throw new Error(`Validation échouée pour ${validationResult.errors.length} lignes. Voir console.`);
        }

        console.log(`✅ ${validationResult.validRows.length} lignes validées avec succès.`);

        // Convertir les données validées en format tableau pour l'UI
        const uiRows = validationResult.validRows.map(row => {
            return [
                row.tournee || '',                  // 0: Tournée
                row.nom_compagnie || '',            // 1: Nom
                row.debut_tournee || '',            // 2: Déb tour
                row.fin_tournee || '',              // 3: Fin tour
                row.classe_vehicule || '',          // 4: Cl véh
                row.id_employe || '',               // 5: Employé
                row.nom_employe_complet || '',      // 6: Nom de l'employé
                row.id_employe_confirm || '',       // 7: Employé (Confirm)
                row.vehicule || '',                 // 8: Véhicule
                row.classe_vehicule_affecte || '',  // 9: Cl véh aff
                row.autorisation || '',             // 10: Autoris
                row.approuve || '',                 // 11: Approuvé
                row.retour || '',                   // 12: Retour
                row.adresse_debut || '',            // 13: Adresse de début
                row.adresse_fin || ''               // 14: Adresse de fin
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
