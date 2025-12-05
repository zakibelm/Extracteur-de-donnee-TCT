import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ParsedContent } from '../types';

// This is a hard requirement. The API key must be obtained from this environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ========== SCHÉMAS TCT ==========
const TCT_TABLE_HEADERS = [
    "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
    "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
    "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin"
];

const tctResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        entries: {
            type: Type.ARRAY,
            description: "Liste des affectations de tournées TCT extraites de l'image.",
            items: {
                type: Type.OBJECT,
                properties: {
                    "Tournée": { type: Type.STRING, description: "Identifiant unique de la tournée." },
                    "Nom": { type: Type.STRING, description: "Nom ou description de la tournée." },
                    "Début tournée": { type: Type.STRING, description: "Heure (HH:mm) ou Date+Heure (JJ/MM/AAAA HH:mm)." },
                    "Fin tournée": { type: Type.STRING, description: "Heure (HH:mm) ou Date+Heure (JJ/MM/AAAA HH:mm)." },
                    "Classe véhicule": { type: Type.STRING, description: "Catégorie ou classe du véhicule." },
                    "Employé": { type: Type.STRING, description: "Identifiant de l'employé." },
                    "Nom de l'employé": { type: Type.STRING, description: "Nom complet de l'employé." },
                    "Véhicule": { type: Type.STRING, description: "Plaque d'immatriculation ou identifiant véhicule." },
                    "Classe véhicule affecté": { type: Type.STRING, description: "Classe du véhicule spécifiquement affecté." },
                    "Stationnement": { type: Type.STRING, description: "Lieu de stationnement." },
                    "Approuvé": { type: Type.STRING, description: "Statut d'approbation, ex: 'Oui', 'Non'." },
                    "Territoire début": { type: Type.STRING, description: "Zone ou territoire de départ." },
                    "Adresse de début": { type: Type.STRING, description: "Adresse complète de départ." },
                    "Adresse de fin": { type: Type.STRING, description: "Adresse complète de fin." },
                },
                required: TCT_TABLE_HEADERS
            }
        }
    },
    required: ["entries"],
};

// ========== SCHÉMAS OLYMEL ==========
const OLYMEL_TABLE_HEADERS = [
    "Date", "Heure", "Transport", "Numéro", "Chauffeur"
];

const olymelResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        entries: {
            type: Type.ARRAY,
            description: "Liste des assignations de transport Olymel extraites de l'image.",
            items: {
                type: Type.OBJECT,
                properties: {
                    "Date": { type: Type.STRING, description: "Date de l'assignation (ex: 'lundi 1er déc.', 'JJ/MM/AAAA')." },
                    "Heure": { type: Type.STRING, description: "Heure de départ (HH:mm)." },
                    "Transport": { type: Type.STRING, description: "Nom du transport ou de la tournée." },
                    "Numéro": { type: Type.STRING, description: "Numéro de véhicule ou identifiant." },
                    "Chauffeur": { type: Type.STRING, description: "Nom complet du chauffeur." },
                },
                required: OLYMEL_TABLE_HEADERS
            }
        }
    },
    required: ["entries"],
};

// Backward compatibility
const TABLE_HEADERS = TCT_TABLE_HEADERS;
const responseSchema = tctResponseSchema;

// =========================================================
// 0. TOOLING LAYER (Nettoyage Structurel & Robustesse)
// =========================================================

/**
 * Extraction robuste du JSON via recherche de limites d'objets.
 * Complexité: O(n) sur la longueur de la chaîne.
 * Corrige le défaut: Fragilité des Regex sur les préambules "Voici le JSON..."
 */
function cleanAndParseJson(text: string): any {
    if (!text) throw new Error("Empty response");

    // Tentative 1: Parsing direct (le plus rapide si l'IA respecte le schéma pur)
    try {
        return JSON.parse(text);
    } catch (e) {
        // Fallback: Recherche des bornes de l'objet JSON
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');

        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            const candidate = text.substring(firstOpen, lastClose + 1);
            try {
                return JSON.parse(candidate);
            } catch (e2) {
                // Fallback 2: Nettoyage des caractères de contrôle invisibles
                try {
                    const sanitized = candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
                    return JSON.parse(sanitized);
                } catch (e3) {
                    throw new Error("JSON_PARSE_ERROR");
                }
            }
        }
        throw new Error("NO_JSON_FOUND");
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
    // Format HH:mm (ex: 09:30, 9:30)
    timeFormat: /^\d{1,2}:\d{2}$/,
    // Format DD/MM/YYYY HH:mm (ex: 20/11/2025 14:30) ou DD/MM HH:mm
    dateTimeFormat: /^\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\s+\d{1,2}:\d{2}$/
};

/**
 * Analyse statistique et règles métiers.
 * Complexité: O(2N) -> Reste O(N).
 */
function observeData(entries: Record<string, string>[]): ValidationResult {
    const issues: string[] = [];
    let invalidCount = 0;
    let criticalErrors = 0;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return { isValid: true, hasCriticalErrors: false, issues: [] };
    }

    // --- Phase 1 : Analyse Statistique de Cohérence (Détection du format dominant) ---
    let timeFormatCount = 0;
    let dateTimeFormatCount = 0;

    // On scanne la colonne "Début tournée" pour voir la tendance
    entries.forEach(e => {
        const val = e["Début tournée"];
        if (!val) return;
        if (OBSERVER_RULES.timeFormat.test(val.trim())) timeFormatCount++;
        else if (OBSERVER_RULES.dateTimeFormat.test(val.trim())) dateTimeFormatCount++;
    });

    // Si on a un mélange (plus de 0 de chaque), on décide que la majorité l'emporte
    const hasMixedFormats = timeFormatCount > 0 && dateTimeFormatCount > 0;
    const preferTimeFormat = timeFormatCount >= dateTimeFormatCount; // Majorité ou égalité -> Heure simple

    const MAX_REPORTED_ISSUES = 10;

    // --- Phase 2 : Validation ligne par ligne ---
    for (let index = 0; index < entries.length; index++) {
        if (issues.length >= MAX_REPORTED_ISSUES) break;

        const entry = entries[index];
        const rowId = entry["Tournée"] || `Ligne ${index + 1}`;

        // Règle Critique : La tournée (clé primaire) doit exister
        if (!entry["Tournée"] || entry["Tournée"].trim() === "") {
            issues.push(`Ligne ${index + 1}: Le champ 'Tournée' est vide (Information critique manquante).`);
            criticalErrors++;
            continue;
        }

        // Règle 1 : Plaque d'immatriculation
        const plate = entry["Véhicule"];
        if (plate && plate.length > 3 && !OBSERVER_RULES.licensePlate.test(plate.trim())) {
            issues.push(`Tournée '${rowId}': Le véhicule '${plate}' a un format suspect (Attendu: AA-123-AA).`);
            invalidCount++;
        }

        // Règle 2 : Cohérence des Dates (Début tournée)
        const dateVal = entry["Début tournée"];
        if (dateVal && dateVal.trim() !== "") {
            if (hasMixedFormats) {
                if (preferTimeFormat && !OBSERVER_RULES.timeFormat.test(dateVal.trim())) {
                    issues.push(`Tournée '${rowId}': Incohérence de format date '${dateVal}'. Veuillez harmoniser au format majoritaire (HH:mm).`);
                    invalidCount++;
                } else if (!preferTimeFormat && !OBSERVER_RULES.dateTimeFormat.test(dateVal.trim())) {
                    issues.push(`Tournée '${rowId}': Incohérence de format date '${dateVal}'. Veuillez harmoniser au format majoritaire (JJ/MM/AAAA HH:mm).`);
                    invalidCount++;
                }
            } else if (timeFormatCount === 0 && dateTimeFormatCount === 0 && !/[\d]+/.test(dateVal)) {
                // Si ni l'un ni l'autre ne match, c'est probablement du bruit
                issues.push(`Tournée '${rowId}': Format de date inconnu '${dateVal}'.`);
                invalidCount++;
            }
        }
    }

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
    systemInstruction: string,
    documentType: 'tct' | 'olymel' = 'tct',
    temperature: number = 0.1
): Promise<string> {
    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType: mimeType,
        },
    };

    // Sélectionner le schéma approprié
    const schema = documentType === 'olymel' ? olymelResponseSchema : tctResponseSchema;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro', // Modèle "Thinking" performant
        contents: { parts: [{ text: promptText }, imagePart] },
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: temperature,
        },
    });

    return response.text || "";
}

/**
 * Extracts tabular data implementing the "Observe-Execute Enrichi" pattern.
 * Instrumentée pour mesurer les performances des étapes.
 */
export async function extractDataFromImage(
    base64Image: string,
    mimeType: string,
    documentType: 'tct' | 'olymel' = 'tct'
): Promise<ParsedContent> {
    console.time('ObserveExecute_Total');

    const isOlymel = documentType === 'olymel';
    const headers = isOlymel ? OLYMEL_TABLE_HEADERS : TCT_TABLE_HEADERS;

    const systemInstruction = isOlymel
        ? `Tu es un extracteur de données expert pour les horaires de transport Olymel.
Ta priorité absolue est la fidélité des données : ne jamais inventer d'informations.
Si une case est vide, laisse la valeur vide "".
Extrais EXACTEMENT les colonnes: Date, Heure, Transport, Numéro, Chauffeur.`
        : `Tu es un extracteur de données expert pour un logiciel de logistique.
Ta priorité absolue est la fidélité des données : ne jamais inventer d'informations.
Si une case est vide, laisse la valeur vide "".`;

    const basePrompt = isOlymel
        ? `Analyse cette image et extrais le tableau "HORAIRE OLYMEL".
Retourne UNIQUEMENT un JSON valide respectant strictement le schéma fourni.
IMPORTANT: 
- Colonne "Date": Extrais la date exacte (ex: "lundi 1er déc.", "02/12/2024")
- Colonne "Heure": Extrais l'heure de départ (HH:mm)
- Colonne "Transport": Nom du transport ou tournée
- Colonne "Numéro": Numéro de véhicule
- Colonne "Chauffeur": Nom complet du chauffeur`
        : `Analyse cette image et extrais le tableau "Affectations des tournées".
Retourne UNIQUEMENT un JSON valide respectant strictement le schéma fourni.
Assure-toi de bien distinguer les caractères ambigus (ex: 0 vs O, 1 vs I).
Pour les dates/heures, essaie de garder une cohérence verticale (format identique pour toute la colonne si possible).`;

    try {
        // --- STEP 1: EXECUTE (Initial Extraction) ---
        console.time('Step1_Extraction');
        console.log(`🔍 [Pattern Observe-Execute] Step 1: Initial Extraction (${documentType.toUpperCase()})...`);
        const initialRawText = await callGemini(base64Image, mimeType, basePrompt, systemInstruction, documentType);
        console.timeEnd('Step1_Extraction');

        let currentEntries: any[] = [];

        // --- STEP 2: OBSERVE (Structure) ---
        try {
            const parsedData = cleanAndParseJson(initialRawText);
            currentEntries = parsedData.entries;
        } catch (jsonError) {
            // DIAGNOSIS: BROKEN_JSON
            console.warn("⚠️ [Pattern Observe-Execute] Diagnosis: BROKEN_JSON. Strategy: Repair Syntax.");
            console.time('Step2_SyntaxRepair');

            const repairJsonPrompt = `Le JSON précédent était invalide.
            Génère le tableau à nouveau.
            IMPORTANT : Assure-toi que le JSON est syntaxiquement parfait.`;

            try {
                // Temperature 0 pour maximiser la structure stricte
                const repairedText = await callGemini(base64Image, mimeType, repairJsonPrompt, systemInstruction, documentType, 0);
                currentEntries = cleanAndParseJson(repairedText).entries;
            } catch (fatalError) {
                console.timeEnd('Step2_SyntaxRepair');
                console.timeEnd('ObserveExecute_Total');
                throw new Error("Échec critique : Impossible de générer un JSON valide après réparation.");
            }
            console.timeEnd('Step2_SyntaxRepair');
        }

        if (!Array.isArray(currentEntries)) {
            // Fallback structurel
            currentEntries = [];
            console.error("Format de données incorrect (pas un tableau 'entries').");
        }

        // --- STEP 3: OBSERVE (Content Validation) ---
        const observation = observeData(currentEntries);

        // --- STEP 4: STRATEGIZE & RE-EXECUTE (Data Correction Loop) ---
        if (!observation.isValid && observation.issues.length > 0) {
            console.warn(`⚠️ [Pattern Observe-Execute] Diagnosis: DATA_QUALITY_ISSUES (${observation.issues.length} issues).`);
            console.log("🛠️ [Pattern Observe-Execute] Strategy: Targeted Correction.");
            console.time('Step4_Correction');

            // Stratégie : On demande explicitement l'harmonisation
            const repairDataPrompt = `
            L'extraction comporte des incohérences ou des erreurs. Corrige UNIQUEMENT ces points :
            ${observation.issues.join('\n')}

            Instructions :
            1. Ne modifie PAS les données déjà correctes.
            2. Si une harmonisation de format (date ou heure) est demandée, applique le format majoritaire à toutes les lignes concernées.
            3. Renvoie le tableau JSON complet corrigé.
            `;

            try {
                // Temperature légèrement supérieure (0.2) pour permettre une "réflexion" sur l'harmonisation
                const correctedText = await callGemini(base64Image, mimeType, repairDataPrompt, systemInstruction, documentType, 0.2);
                const correctedData = cleanAndParseJson(correctedText);

                if (correctedData && Array.isArray(correctedData.entries)) {
                    currentEntries = correctedData.entries;
                    console.log("✅ [Pattern Observe-Execute] Correction applied.");
                }
            } catch (retryError) {
                console.error("❌ [Pattern Observe-Execute] Correction failed. Fallback to initial data.", retryError);
            }
            console.timeEnd('Step4_Correction');
        } else {
            console.log("✅ [Pattern Observe-Execute] Observation passed. Perfect data.");
        }

        console.timeEnd('ObserveExecute_Total');

        // Formatting for output (TableData)
        const rows: string[][] = currentEntries.map((entry: Record<string, string>) =>
            headers.map(header => entry[header] || '')
        );

        return { headers, rows };

    } catch (error) {
        console.timeEnd('ObserveExecute_Total');
        console.error("Gemini Service Fatal Error:", error);
        let errorMessage = "Erreur d'extraction.";
        if (error instanceof Error) errorMessage = error.message;

        return { headers: ["Erreur"], rows: [[errorMessage]] };
    }
}
