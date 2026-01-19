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
 * Normalise les différents formats de réponse JSON de l'IA
 */
function normalizeAIResponse(data: any): AIResponse {
    console.log('🔄 Normalisation du format JSON...', Object.keys(data));

    // Format attendu : { phase: "execute", headers_detected: [...], data: [...] }
    if (data.phase && data.data) {
        console.log('✅ Format standard détecté');
        return data as AIResponse;
    }

    // Format alternatif 1 : { tournees: [...] } ou { rows: [...] }
    if (data.tournees || data.rows) {
        console.log('🔄 Conversion du format alternatif (tournees/rows)');
        const rawRows = data.tournees || data.rows;

        const normalizedData: AIResponse = {
            phase: 'execute',
            headers_detected: TABLE_HEADERS,
            total_headers: TABLE_HEADERS.length,
            data: []
        };

        rawRows.forEach((row: any, index: number) => {
            const cells: Array<{ column_header: string; value: string }> = [];

            // Fonction helper pour récupérer la valeur depuis différentes clés possibles
            const getValue = (keys: string[]) => {
                for (const key of keys) {
                    if (row[key] !== undefined) return String(row[key] || '');
                }
                return '';
            };

            // Mapper chaque colonne avec toutes les variantes possibles de noms de clés
            cells.push({ column_header: 'Tournée', value: getValue(['tournee', 'Tournée']) });
            cells.push({ column_header: 'Nom', value: getValue(['nom', 'Nom', 'nom_compagnie']) });
            cells.push({ column_header: 'Déb tour', value: getValue(['deb_tour', 'debut_tour', 'Déb tour']) });
            cells.push({ column_header: 'Fin tour', value: getValue(['fin_tour', 'Fin tour']) });
            cells.push({ column_header: 'Cl véh', value: getValue(['cl_veh', 'classe_vehicule', 'Cl véh']) });
            cells.push({ column_header: 'Employé', value: getValue(['employe', 'id_employe', 'Employé']) });
            cells.push({ column_header: 'Nom de l\'employé', value: getValue(['nom_employe', 'nom_de_l_employe', 'Nom de l\'employé']) });
            cells.push({ column_header: 'Employé (Confirm)', value: getValue(['employe_confirm', 'Employé (Confirm)']) });
            cells.push({ column_header: 'Véhicule', value: getValue(['vehicule', 'Véhicule']) });
            cells.push({ column_header: 'Cl véh aff', value: getValue(['cl_veh_aff', 'classe_vehicule_affecte', 'Cl véh aff']) });
            cells.push({ column_header: 'Autoris', value: getValue(['autoris', 'autorisation', 'Autoris']) });
            cells.push({ column_header: 'Approuvé', value: getValue(['approuve', 'Approuvé']) });
            cells.push({ column_header: 'Retour', value: getValue(['retour', 'Retour']) });
            cells.push({ column_header: 'Adresse de début', value: getValue(['adresse_debut', 'adresse_de_debut', 'Adresse de début']) });
            cells.push({ column_header: 'Adresse de fin', value: getValue(['adresse_fin', 'adresse_de_fin', 'Adresse de fin']) });

            normalizedData.data.push({
                row_number: index + 1,
                cells: cells
            });
        });

        console.log(`✅ Normalisé ${normalizedData.data.length} lignes depuis format alternatif`);
        return normalizedData;
    }

    // Format alternatif 2 : { headers: [...], rows: [[...]] }
    if (data.headers && Array.isArray(data.rows)) {
        console.log('🔄 Conversion du format headers/rows tableau');
        const normalizedData: AIResponse = {
            phase: 'execute',
            headers_detected: data.headers,
            total_headers: data.headers.length,
            data: []
        };

        data.rows.forEach((row: string[], index: number) => {
            const cells = row.map((value, colIndex) => ({
                column_header: data.headers[colIndex] || `Colonne ${colIndex + 1}`,
                value: String(value || '')
            }));

            normalizedData.data.push({
                row_number: index + 1,
                cells: cells
            });
        });

        console.log(`✅ Normalisé ${normalizedData.data.length} lignes depuis format tableau`);
        return normalizedData;
    }

    // Si aucun format reconnu, lever une erreur
    console.error('❌ Format JSON non reconnu:', Object.keys(data));
    throw new Error(`Format JSON non reconnu. Clés trouvées: ${Object.keys(data).join(', ')}. Le modèle IA doit retourner un format avec 'phase' et 'data', ou 'tournees', ou 'headers' et 'rows'.`);
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

        let jsonContent = result.choices[0].message.content;
        console.log('📥 Contenu brut reçu:', jsonContent.substring(0, 300) + '...');

        // Extraire le JSON s'il y a du texte avant/après
        const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonContent = jsonMatch[0];
            console.log('✂️ JSON extrait:', jsonContent.substring(0, 200) + '...');
        }

        // Parser le JSON
        let aiData: any;
        try {
            aiData = JSON.parse(jsonContent);
        } catch (e) {
            console.error("❌ Erreur parsing JSON:", e);
            console.error("Contenu reçu:", jsonContent.substring(0, 500));
            throw new Error("L'IA n'a pas retourné un JSON valide. Vérifiez la console pour plus de détails.");
        }

        // Normaliser le format si l'IA a retourné un format différent
        aiData = normalizeAIResponse(aiData);

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
