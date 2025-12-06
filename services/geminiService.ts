import { ParsedContent } from '../types';

// =========================================================
// MOCKED TYPES (Best Practice: Avoid importing @google/genai in frontend)
// =========================================================
const Type = {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING"
};
type Schema = any;

// =========================================================
// API CLIENT (Optimized)
// =========================================================

async function callGemini(
    base64Image: string,
    mimeType: string,
    promptText: string,
    systemInstruction: string,
    documentType: 'tct' | 'olymel' = 'tct',
    temperature: number = 0.1
): Promise<string> {

    // Select correct schema
    const schema = documentType === 'olymel' ? olymelResponseSchema : tctResponseSchema;

    try {
        // Call our Secure Serverless Proxy
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: promptText,
                image: base64Image,
                mimeType: mimeType,
                systemInstruction: systemInstruction,
                temperature: temperature,
                schema: schema
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server Error: ${response.status}`);
        }

        const data = await response.json();
        return data.text || "";

    } catch (error) {
        console.error("API Call Failed:", error);
        throw error;
    }
}

// =========================================================
// DATA SCHEMAS (Defined locally for best performance)
// =========================================================

// TCT Schema
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

// Olymel Schema
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

// =========================================================
// UTILITIES: Data Parsing & Cleaning
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
            try { return JSON.parse(candidate); } catch (e2) {
                try { return JSON.parse(candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")); }
                catch (e3) { throw new Error("JSON_PARSE_ERROR"); }
            }
        }
        throw new Error("NO_JSON_FOUND");
    }
}

// =========================================================
// UTILITIES: Data Observation (Validation)
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

    const preferTimeFormat = timeFormatCount >= dateTimeFormatCount;
    const hasMixedFormats = timeFormatCount > 0 && dateTimeFormatCount > 0;
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
            issues.push(`Tournée '${rowId}': Le véhicule '${plate}' a un format suspect.`);
            invalidCount++;
        }

        const dateVal = entry["Début tournée"];
        if (dateVal && dateVal.trim() !== "") {
            if (hasMixedFormats) {
                if (preferTimeFormat && !OBSERVER_RULES.timeFormat.test(dateVal.trim())) {
                    issues.push(`Tournée '${rowId}': Incohérence de format date '${dateVal}'. Attendu: HH:mm.`);
                    invalidCount++;
                } else if (!preferTimeFormat && !OBSERVER_RULES.dateTimeFormat.test(dateVal.trim())) {
                    issues.push(`Tournée '${rowId}': Incohérence de format date '${dateVal}'. Attendu: JJ/MM/AAAA HH:mm.`);
                    invalidCount++;
                }
            }
        }
    }

    return { isValid: invalidCount === 0 && criticalErrors === 0, hasCriticalErrors: criticalErrors > 0, issues };
}

// =========================================================
// MAIN FUNCTION: Observe-Execute Pattern
// =========================================================

export async function extractDataFromImage(
    base64Image: string,
    mimeType: string,
    documentType: 'tct' | 'olymel' = 'tct'
): Promise<ParsedContent> {
    console.time('ObserveExecute_Total');

    const isOlymel = documentType === 'olymel';
    const headers = isOlymel ? OLYMEL_TABLE_HEADERS : TCT_TABLE_HEADERS;

    const systemInstruction = isOlymel
        ? `Tu es un extracteur de données expert pour les horaires de transport Olymel. Fidélité absolue des données requise.`
        : `Tu es un extracteur de données expert pour un logiciel de logistique. Fidélité absolue des données requise.`;

    const basePrompt = isOlymel
        ? `Analyse cette image et extrais le tableau "HORAIRE OLYMEL" en JSON valide.`
        : `Analyse cette image et extrais le tableau "Affectations des tournées" en JSON valide.`;

    try {
        // Step 1: Execute
        const initialRawText = await callGemini(base64Image, mimeType, basePrompt, systemInstruction, documentType);

        let currentEntries: any[] = [];

        // Step 2: Observe (Structure)
        try {
            const parsedData = cleanAndParseJson(initialRawText);
            currentEntries = parsedData.entries || [];
        } catch (jsonError) {
            console.warn("Broken JSON. Attempting repair...");
            // Simple repair attempt logic omitted for brevity in optimized version, relying on strong heavy logic from initial prompt
            // Re-try with strict prompt if needed
            const repairPrompt = "Le JSON était invalide. Génère UNIQUEMENT le JSON valide maintenant.";
            const repairedText = await callGemini(base64Image, mimeType, repairPrompt, systemInstruction, documentType, 0);
            currentEntries = cleanAndParseJson(repairedText).entries || [];
        }

        // Step 3: Observe (Content)
        const observation = observeData(currentEntries);

        // Step 4: Strategize & Re-Execute (Correction)
        if (!observation.isValid && observation.issues.length > 0) {
            console.warn(`Data Quality Issues: ${observation.issues.length}`);
            // Correction logic...
            const repairDataPrompt = `Corrige ces erreurs:\n${observation.issues.join('\n')}\nRenvoie le JSON complet corrigé.`;
            try {
                const correctedText = await callGemini(base64Image, mimeType, repairDataPrompt, systemInstruction, documentType, 0.2);
                const correctedData = cleanAndParseJson(correctedText);
                currentEntries = correctedData.entries || currentEntries;
            } catch (e) { console.error("Correction failed, using initial data."); }
        }

        console.timeEnd('ObserveExecute_Total');

        const rows: string[][] = currentEntries.map((entry: Record<string, string>) =>
            headers.map(header => entry[header] || '')
        );

        return { headers, rows };

    } catch (error) {
        console.timeEnd('ObserveExecute_Total');
        console.error("Gemini Extraction Fatal Error:", error);
        return { headers: ["Erreur"], rows: [[error instanceof Error ? error.message : "Erreur inconnue"]] };
    }
}
