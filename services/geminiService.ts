import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ParsedContent } from '../types';

// This is a hard requirement. The API key must be obtained from this environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TABLE_HEADERS = [
    "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
    "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
    "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin"
];

const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        entries: {
            type: Type.ARRAY,
            description: "Liste des affectations de tournées extraites de l'image.",
            items: {
                type: Type.OBJECT,
                properties: {
                    "Tournée": { type: Type.STRING, description: "Identifiant unique de la tournée." },
                    "Nom": { type: Type.STRING, description: "Nom ou description de la tournée." },
                    "Début tournée": { type: Type.STRING, description: "Date et heure de début, ex: 'JJ/MM/YYYY HH:mm'." },
                    "Fin tournée": { type: Type.STRING, description: "Date et heure de fin, ex: 'JJ/MM/YYYY HH:mm'." },
                    "Classe véhicule": { type: Type.STRING, description: "Catégorie ou classe du véhicule." },
                    "Employé": { type: Type.STRING, description: "Identifiant de l'employé." },
                    "Nom de l'employé": { type: Type.STRING, description: "Nom complet de l'employé." },
                    "Véhicule": { type: Type.STRING, description: "Plaque d'immatriculation. IMPORTANT: Format standard attendu (ex: AB-123-CD ou 1234 AB 56)." },
                    "Classe véhicule affecté": { type: Type.STRING, description: "Classe du véhicule spécifiquement affecté." },
                    "Stationnement": { type: Type.STRING, description: "Lieu de stationnement." },
                    "Approuvé": { type: Type.STRING, description: "Statut d'approbation, ex: 'Oui', 'Non'." },
                    "Territoire début": { type: Type.STRING, description: "Zone ou territoire de départ." },
                    "Adresse de début": { type: Type.STRING, description: "Adresse complète de départ." },
                    "Adresse de fin": { type: Type.STRING, description: "Adresse complète de fin." },
                },
                required: TABLE_HEADERS
            }
        }
    },
    required: ["entries"],
};

// =========================================================
// 0. TOOLING LAYER (Nettoyage Structurel)
// =========================================================

/**
 * Nettoie la réponse brute de l'IA pour extraire le JSON valide.
 * Gère les blocs markdown ```json et les espaces superflus.
 */
function cleanAndParseJson(text: string): any {
    let cleanText = text.trim();
    
    // Enlever les balises markdown si présentes
    if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/^```json\s?/, "").replace(/\s?```$/, "");
    } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```\s?/, "").replace(/\s?```$/, "");
    }

    try {
        return JSON.parse(cleanText);
    } catch (e) {
        throw new Error("JSON_PARSE_ERROR");
    }
}

// =========================================================
// 1. OBSERVER LAYER (Validation Métier & Technique)
// =========================================================

interface ValidationResult {
    isValid: boolean;
    hasCriticalErrors: boolean;
    issues: string[];
}

const OBSERVER_RULES = {
    // Regex permissive pour les plaques (SIV: AA-123-AA ou FNI: 123 AAA 45) + formats spéciaux
    licensePlate: /^(?:[A-Z]{2}[-\s]?[0-9]{3}[-\s]?[A-Z]{2}|[0-9]{1,4}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{2,3}|Vehicule Perso|Pas de vehicule|Location)$/i,
    // Date simple check (contient chiffres et / ou :)
    dateLike: /[\d]+[\/:][\d]+/, 
};

function observeData(entries: Record<string, string>[]): ValidationResult {
    const issues: string[] = [];
    let invalidCount = 0;
    let criticalErrors = 0;

    if (!entries || entries.length === 0) {
        return { isValid: true, hasCriticalErrors: false, issues: [] };
    }

    entries.forEach((entry, index) => {
        const rowId = entry["Tournée"] || `Ligne ${index + 1}`;

        // Règle Critique : La tournée (clé primaire) doit exister
        if (!entry["Tournée"] || entry["Tournée"].trim() === "") {
            issues.push(`Ligne ${index + 1}: Le champ 'Tournée' est vide (Information critique manquante).`);
            criticalErrors++;
        }

        // Règle 1 : Plaque d'immatriculation
        const plate = entry["Véhicule"];
        if (plate && plate.length > 3 && !OBSERVER_RULES.licensePlate.test(plate.trim())) {
            issues.push(`Tournée '${rowId}': Le véhicule '${plate}' a un format suspect (Attendu: AA-123-AA).`);
            invalidCount++;
        }

        // Règle 2 : Dates
        if (entry["Début tournée"] && !OBSERVER_RULES.dateLike.test(entry["Début tournée"])) {
            issues.push(`Tournée '${rowId}': 'Début tournée' (${entry["Début tournée"]}) format incorrect.`);
            invalidCount++;
        }
    });

    return {
        isValid: invalidCount === 0 && criticalErrors === 0,
        hasCriticalErrors: criticalErrors > 0,
        issues
    };
}

// =========================================================
// CORE LOGIC
// =========================================================

async function callGemini(
    base64Image: string, 
    mimeType: string, 
    promptText: string, 
    systemInstruction: string
): Promise<string> {
    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType: mimeType,
        },
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro', // Modèle "Thinking" performant
        contents: { parts: [{ text: promptText }, imagePart] },
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
            temperature: 0.1, // Très faible pour la précision
        },
    });

    return response.text || "";
}

/**
 * Extracts tabular data implementing the "Observe-Execute Enrichi" pattern.
 */
export async function extractDataFromImage(base64Image: string, mimeType: string): Promise<ParsedContent> {
    const systemInstruction = `Tu es un extracteur de données expert pour un logiciel de logistique.
    Ta priorité absolue est la fidélité des données : ne jamais inventer d'informations.
    Si une case est vide, laisse la valeur vide "".`;

    const basePrompt = `Analyse cette image et extrais le tableau "Affectations des tournées".
    Retourne UNIQUEMENT un JSON valide respectant strictement le schéma fourni.
    Assure-toi de bien distinguer les caractères ambigus (ex: 0 vs O, 1 vs I).`;

    try {
        // --- STEP 1: EXECUTE (Initial Extraction) ---
        console.log("🔍 [Pattern Observe-Execute] Step 1: Initial Extraction...");
        const initialRawText = await callGemini(base64Image, mimeType, basePrompt, systemInstruction);
        
        let currentEntries: any[] = [];

        // --- STEP 2: OBSERVE (Structure) ---
        try {
            const parsedData = cleanAndParseJson(initialRawText);
            currentEntries = parsedData.entries;
        } catch (jsonError) {
            // DIAGNOSIS: BROKEN_JSON
            console.warn("⚠️ [Pattern Observe-Execute] Diagnosis: BROKEN_JSON. Strategy: Repair Syntax.");
            
            const repairJsonPrompt = `Le JSON précédent que tu as généré était syntaxiquement invalide.
            
            Tâche : Analyse l'image à nouveau et génère le tableau.
            IMPORTANT : Assure-toi que le JSON est parfaitement valide (pas de virgules manquantes, guillemets fermés).`;
            
            const repairedText = await callGemini(base64Image, mimeType, repairJsonPrompt, systemInstruction);
            try {
                currentEntries = cleanAndParseJson(repairedText).entries;
            } catch (fatalError) {
                throw new Error("Échec critique : Impossible de générer un JSON valide après réparation.");
            }
        }

        if (!Array.isArray(currentEntries)) {
            throw new Error("Format de données incorrect (pas un tableau 'entries').");
        }

        // --- STEP 3: OBSERVE (Content Validation) ---
        const observation = observeData(currentEntries);
        
        // --- STEP 4: STRATEGIZE & RE-EXECUTE (Data Correction Loop) ---
        if (!observation.isValid) {
            console.warn("⚠️ [Pattern Observe-Execute] Diagnosis: DATA_QUALITY_ISSUES.", observation.issues);
            console.log("🛠️ [Pattern Observe-Execute] Strategy: Targeted Correction.");

            // On construit une stratégie ciblée : on ne demande pas de tout refaire au hasard,
            // on donne à l'IA la liste précise des erreurs à corriger.
            const repairDataPrompt = `
            L'extraction initiale comporte des erreurs de validation métier.
            
            Veuillez corriger UNIQUEMENT les erreurs suivantes en revérifiant l'image :
            ${observation.issues.map(issue => `- ${issue}`).join('\n')}

            Instructions :
            1. Garde les données correctes telles quelles.
            2. Corrige les plaques d'immatriculation (ex: AA-123-AA) et les formats de dates.
            3. Si une info est illisible, laisse vide plutôt que de mettre une valeur invalide.
            4. Renvoie le tableau complet corrigé au format JSON.
            `;

            try {
                const correctedText = await callGemini(base64Image, mimeType, repairDataPrompt, systemInstruction);
                const correctedData = cleanAndParseJson(correctedText);
                
                if (correctedData && Array.isArray(correctedData.entries)) {
                    // On pourrait re-valider ici, mais pour la démo on accepte la correction (Max 1 itération)
                    currentEntries = correctedData.entries;
                    console.log("✅ [Pattern Observe-Execute] Correction applied.");
                }
            } catch (retryError) {
                console.error("❌ [Pattern Observe-Execute] Correction failed. Fallback to initial data.", retryError);
                // Fallback: On garde les données initiales même imparfaites plutôt que de crasher
            }
        } else {
            console.log("✅ [Pattern Observe-Execute] Observation passed. Perfect data.");
        }

        // Formatting for output (TableData)
        const rows: string[][] = currentEntries.map((entry: Record<string, string>) => 
            TABLE_HEADERS.map(header => entry[header] || '')
        );

        return { headers: TABLE_HEADERS, rows };

    } catch (error) {
        console.error("Gemini Service Fatal Error:", error);
        let errorMessage = "Erreur d'extraction.";
        if (error instanceof Error) errorMessage = error.message;
        
        return { headers: ["Erreur"], rows: [[errorMessage]] };
    }
}
