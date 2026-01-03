import { ParsedContent } from '../types';

// ========== SCHÉMAS TCT ==========
const TCT_TABLE_HEADERS = [
    "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
    "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
    "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin"
];

const tctResponseSchema = {
    type: "OBJECT",
    properties: {
        entries: {
            type: "ARRAY",
            description: "Liste des affectations de tournées TCT extraites de l'image.",
            items: {
                type: "OBJECT",
                properties: {
                    "Tournée": { type: "STRING", description: "Identifiant unique de la tournée." },
                    "Nom": { type: "STRING", description: "Nom ou description de la tournée." },
                    "Début tournée": { type: "STRING", description: "Heure (HH:mm) ou Date+Heure (JJ/MM/AAAA HH:mm)." },
                    "Fin tournée": { type: "STRING", description: "Heure (HH:mm) ou Date+Heure (JJ/MM/AAAA HH:mm)." },
                    "Classe véhicule": { type: "STRING", description: "Catégorie ou classe du véhicule." },
                    "Employé": { type: "STRING", description: "Identifiant de l'employé." },
                    "Nom de l'employé": { type: "STRING", description: "Nom complet de l'employé." },
                    "Véhicule": { type: "STRING", description: "Plaque d'immatriculation ou identifiant véhicule." },
                    "Classe véhicule affecté": { type: "STRING", description: "Classe du véhicule spécifiquement affecté." },
                    "Stationnement": { type: "STRING", description: "Lieu de stationnement." },
                    "Approuvé": { type: "STRING", description: "Statut d'approbation, ex: 'Oui', 'Non'." },
                    "Territoire début": { type: "STRING", description: "Zone ou territoire de départ." },
                    "Adresse de début": { type: "STRING", description: "Adresse complète de départ." },
                    "Adresse de fin": { type: "STRING", description: "Adresse complète de fin." },
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

const olymelResponseSchema = {
    type: "OBJECT",
    properties: {
        entries: {
            type: "ARRAY",
            description: "Liste des assignations de transport Olymel extraites de l'image.",
            items: {
                type: "OBJECT",
                properties: {
                    "Date": { type: "STRING", description: "Date de l'assignation (ex: 'lundi 1er déc.', 'JJ/MM/AAAA')." },
                    "Heure": { type: "STRING", description: "Heure de départ (HH:mm)." },
                    "Transport": { type: "STRING", description: "Nom du transport ou de la tournée." },
                    "Numéro": { type: "STRING", description: "Numéro de véhicule ou identifiant." },
                    "Chauffeur": { type: "STRING", description: "Nom complet du chauffeur." },
                },
                required: OLYMEL_TABLE_HEADERS
            }
        }
    },
    required: ["entries"],
};

// Backward compatibility
const TABLE_HEADERS = TCT_TABLE_HEADERS;

// =========================================================
// 0. TOOLING LAYER (Nettoyage Structurel & Robustesse)
// =========================================================

function cleanAndParseJson(text: string): any {
    if (!text) throw new Error("Empty response");

    try {
        return JSON.parse(text);
    } catch (e) {
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');

        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            const candidate = text.substring(firstOpen, lastClose + 1);
            try {
                return JSON.parse(candidate);
            } catch (e2) {
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
    licensePlate: /^(?:[A-Z]{2}[-\s]?[0-9]{3}[-\s]?[A-Z]{2}|[0-9]{1,4}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{2,3}|Vehicule Perso|Pas de vehicule|Location)$/i,
    timeFormat: /^\d{1,2}:\d{2}$/,
    dateTimeFormat: /^\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\s+\d{1,2}:\d{2}$/
};

function observeData(entries: Record<string, string>[]): ValidationResult {
    const issues: string[] = [];
    let invalidCount = 0;
    let criticalErrors = 0;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return { isValid: true, hasCriticalErrors: false, issues: [] };
    }

    let timeFormatCount = 0;
    let dateTimeFormatCount = 0;

    entries.forEach(e => {
        const val = e["Début tournée"];
        if (!val) return;
        if (OBSERVER_RULES.timeFormat.test(val.trim())) timeFormatCount++;
        else if (OBSERVER_RULES.dateTimeFormat.test(val.trim())) dateTimeFormatCount++;
    });

    const hasMixedFormats = timeFormatCount > 0 && dateTimeFormatCount > 0;
    const preferTimeFormat = timeFormatCount >= dateTimeFormatCount;

    const MAX_REPORTED_ISSUES = 10;

    for (let index = 0; index < entries.length; index++) {
        if (issues.length >= MAX_REPORTED_ISSUES) break;

        const entry = entries[index];
        const rowId = entry["Tournée"] || `Ligne ${index + 1}`;

        if (!entry["Tournée"] || entry["Tournée"].trim() === "") {
            issues.push(`Ligne ${index + 1}: Le champ 'Tournée' est vide (Information critique manquante).`);
            criticalErrors++;
            continue;
        }

        const plate = entry["Véhicule"];
        if (plate && plate.length > 3 && !OBSERVER_RULES.licensePlate.test(plate.trim())) {
            issues.push(`Tournée '${rowId}': Le véhicule '${plate}' a un format suspect (Attendu: AA-123-AA).`);
            invalidCount++;
        }

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

// ... imports

export interface ExtractionOptions {
    apiKey?: string;
    model?: string;
    systemPrompt?: string;
}

async function callGemini(
    base64Image: string,
    mimeType: string,
    promptText: string,
    systemInstruction: string,
    documentType: 'tct' | 'olymel' = 'tct',
    temperature: number = 0.1,
    options?: ExtractionOptions
): Promise<string> {
    const schema = documentType === 'olymel' ? olymelResponseSchema : tctResponseSchema;

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: promptText,
                image: base64Image,
                mimeType,
                systemInstruction: options?.systemPrompt || systemInstruction,
                temperature,
                schema,
                // Options passed to backend
                apiKey: options?.apiKey,
                model: options?.model
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erreur API inconnue');
        }

        const data = await response.json();
        return data.text || "";

    } catch (e: any) {
        console.error("Erreur Appel API (Proxy):", e);
        throw e;
    }
}

export async function extractDataFromImage(
    base64Image: string,
    mimeType: string,
    documentType: 'tct' | 'olymel' = 'tct',
    options?: ExtractionOptions
): Promise<ParsedContent> {
    console.time('ObserveExecute_Total');

    const isOlymel = documentType === 'olymel';
    const headers = isOlymel ? OLYMEL_TABLE_HEADERS : TCT_TABLE_HEADERS;

    const defaultSystemInstruction = isOlymel
        ? `Tu es un extracteur de données expert pour les horaires de transport Olymel.
Ta priorité absolue est la fidélité des données : ne jamais inventer d'informations.
Si une case est vide, laisse la valeur vide "".
Extrais EXACTEMENT les colonnes: Date, Heure, Transport, Numéro, Chauffeur.`
        : `Tu es un extracteur de données expert pour un logiciel de logistique.
Ta priorité absolue est la fidélité des données : ne jamais inventer d'informations.
Si une case est vide, laisse la valeur vide "".`;

    const systemInstruction = options?.systemPrompt && options.systemPrompt.trim() !== ''
        ? options.systemPrompt
        : defaultSystemInstruction;

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
        console.time('Step1_Extraction');
        console.log(`🔍 [Pattern Observe-Execute] Step 1: Initial Extraction (${documentType.toUpperCase()})...`);
        const initialRawText = await callGemini(base64Image, mimeType, basePrompt, systemInstruction, documentType, 0.1, options);
        console.timeEnd('Step1_Extraction');

        let currentEntries: any[] = [];

        try {
            const parsedData = cleanAndParseJson(initialRawText);
            currentEntries = parsedData.entries;
        } catch (jsonError) {
            console.warn("⚠️ [Pattern Observe-Execute] Diagnosis: BROKEN_JSON. Strategy: Repair Syntax.");
            console.time('Step2_SyntaxRepair');

            const repairJsonPrompt = `Le JSON précédent était invalide.
            Génère le tableau à nouveau.
            IMPORTANT : Assure-toi que le JSON est syntaxiquement parfait.`;

            try {
                const repairedText = await callGemini(base64Image, mimeType, repairJsonPrompt, systemInstruction, documentType, 0, options);
                currentEntries = cleanAndParseJson(repairedText).entries;
            } catch (fatalError) {
                console.timeEnd('Step2_SyntaxRepair');
                console.timeEnd('ObserveExecute_Total');
                throw new Error("Échec critique : Impossible de générer un JSON valide après réparation.");
            }
            console.timeEnd('Step2_SyntaxRepair');
        }

        if (!Array.isArray(currentEntries)) {
            currentEntries = [];
            console.error("Format de données incorrect (pas un tableau 'entries').");
        }

        const observation = observeData(currentEntries);

        if (!observation.isValid && observation.issues.length > 0) {
            console.warn(`⚠️ [Pattern Observe-Execute] Diagnosis: DATA_QUALITY_ISSUES (${observation.issues.length} issues).`);
            console.log("🛠️ [Pattern Observe-Execute] Strategy: Targeted Correction.");
            console.time('Step4_Correction');

            const repairDataPrompt = `
            L'extraction comporte des incohérences ou des erreurs. Corrige UNIQUEMENT ces points :
            ${observation.issues.join('\n')}

            Instructions :
            1. Ne modifie PAS les données déjà correctes.
            2. Si une harmonisation de format (date ou heure) est demandée, applique le format majoritaire à toutes les lignes concernées.
            3. Renvoie le tableau JSON complet corrigé.
            `;

            try {
                const correctedText = await callGemini(base64Image, mimeType, repairDataPrompt, systemInstruction, documentType, 0.2, options);
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

