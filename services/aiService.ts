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
Extrais ce tableau COLONNE PAR COLONNE en comptant les positions.

ATTENTION CRITIQUE: Le tableau a 15 COLONNES EXACTEMENT.
Tu DOIS lire chaque ligne de GAUCHE À DROITE en comptant les colonnes.

STRUCTURE EXACTE DES 15 COLONNES:
Colonne 1: "Tournée" (code comme TCT0028, TCT0004)
Colonne 2: "Nom" (nom compagnie comme "TAXI COOP TERREBONNE")
Colonne 3: "Déb tour" (heure de début comme 9:12, 9:57)
Colonne 4: "Fin tour" (heure de fin comme 9:40, 11:20)
Colonne 5: "Cl véh" (classe véhicule comme TAXI, MINIVAN)
Colonne 6: "Employé" (ID employé PREMIER - comme 0450, 0379)
Colonne 7: "Nom de l'employé" (nom complet - peut contenir virgules)
Colonne 8: "Employé" (ID employé DEUXIÈME - souvent = colonne 6)
Colonne 9: "Véhicule" (NUMÉRO de véhicule - comme 232, 134, 471)
Colonne 10: "Cl véh aff" (classe affectée - comme TAXI, MINIVAN)
Colonne 11: "Autoris" (autorisation - souvent vide)
Colonne 12: "Approuvé" (checkmark ✓ ou vide)
Colonne 13: "Retour" (territoire retour - souvent vide)
Colonne 14: "Adresse de début" (adresse COMPLÈTE avec code postal)
Colonne 15: "Adresse de fin" (adresse COMPLÈTE avec code postal)

STRUCTURE JSON À RETOURNER:
{
  "phase": "execute",
  "headers_detected": [...15 en-têtes ci-dessus...],
  "total_headers": 15,
  "data": [
    {
      "row_number": 1,
      "cells": [
        { "column_header": "Tournée", "value": "TCT0028" },
        { "column_header": "Nom", "value": "TAXI COOP TERREBONNE" },
        { "column_header": "Déb tour", "value": "9:12" },
        { "column_header": "Fin tour", "value": "9:40" },
        { "column_header": "Cl véh", "value": "TAXI" },
        { "column_header": "Employé", "value": "0450" },
        { "column_header": "Nom de l'employé", "value": "Rezali, Karim" },
        { "column_header": "Employé", "value": "0450" },
        { "column_header": "Véhicule", "value": "232" },
        { "column_header": "Cl véh aff", "value": "MINIVAN" },
        { "column_header": "Autoris", "value": "" },
        { "column_header": "Approuvé", "value": "✓" },
        { "column_header": "Retour", "value": "" },
        { "column_header": "Adresse de début", "value": "3177 Napoléon BOUL Terrebonne J6X 4R7" },
        { "column_header": "Adresse de fin", "value": "3455 De Gaspe AV Montreal H1L 1A8" }
      ]
    }
  ]
}

RÈGLES ABSOLUES:
1. COMPTE LES COLONNES: Commence à colonne 1 (Tournée) et compte jusqu'à 15.
2. NE SAUTE AUCUNE COLONNE: Même si vide, crée la cellule avec "value": "".
3. COLONNE 9 = NUMÉRO: La colonne "Véhicule" doit contenir UN NUMÉRO (232, 134, 471), PAS un nom ou ID employé.
4. ADRESSES COMPLÈTES: Colonnes 14-15 doivent avoir l'adresse avec code postal (ex: "3177 Napoléon BOUL Terrebonne J6X 4R7").
5. NOM EMPLOYÉ (col 7): Extrait le nom sans ID. Si la cellule dit "Rezali, Karim, 0450", extrait "Rezali, Karim".
6. DEUX COLONNES EMPLOYÉ: Colonne 6 ET colonne 8 contiennent l'ID employé (souvent identique).

EXEMPLE LIGNE TCT0004 (VÉRIFICATION):
Colonne 1: "TCT0004"
Colonne 2: "TAXI COOP TERREBONNE"
Colonne 3: "9:57"
Colonne 4: "11:20"
Colonne 5: "TAXI"
Colonne 6: "0450" (ID employé)
Colonne 7: "Rezali, Karim" (SANS le 0450 à la fin)
Colonne 8: "0450" (ID employé confirmé)
Colonne 9: "232" (NUMÉRO véhicule - PAS 0450!)
Colonne 10: "MINIVAN"
Colonne 11-13: "" (souvent vides)
Colonne 14: "3177 Napoléon BOUL Terrebonne J6X 4R7"
Colonne 15: "5455 De Gaspe AV Montreal H1L 1A8"

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
                        text: "Extrait ce tableau cellule par cellule. CRITIQUE: Aligne visuellement chaque cellule avec son en-tête de colonne. Vérifie que la colonne 'Véhicule' contient bien des numéros (232, 0450, etc.) et que les adresses sont complètes avec le code postal."
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
                row.changement || '',               // 9: Changement (défaut = véhicule)
                row.changement_par || '',           // 10: Changement par (défaut = véhicule)
                row.classe_vehicule_affecte || '',  // 11: Cl véh aff
                row.autorisation || '',             // 12: Autoris
                row.approuve || '',                 // 13: Approuvé
                row.retour || '',                   // 14: Retour
                row.adresse_debut || '',            // 15: Adresse de début
                row.adresse_fin || ''               // 16: Adresse de fin
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
