
import { ParsedContent } from '../types';

// =========================================================
// TYPE DEFINITIONS
// =========================================================
const Type = {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING"
};
type Schema = any;

// =========================================================
// API CLIENT - OpenRouter Only
// =========================================================

async function callOpenRouter(
    base64Image: string,
    mimeType: string,
    promptText: string,
    systemInstruction: string,
    documentType: 'tct' | 'olymel' = 'tct',
    temperature: number = 0.1
): Promise<string> {

    // Select correct schema
    const schema = documentType === 'olymel' ? undefined : tctResponseSchema;

    // Load settings from localStorage
    let settings: any = {};
    try {
        const saved = localStorage.getItem('edt_settings');
        if (saved) {
            settings = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Could not load settings, using defaults');
    }

    const apiKey = settings.openrouterApiKey;
    const model = settings.openrouterModel || 'anthropic/claude-3.5-sonnet';
    const userTemperature = settings.temperature !== undefined ? settings.temperature : temperature;

    try {
        // Build headers with configuration
        const headers: any = {
            'Content-Type': 'application/json',
            'X-Model': model
        };

        // Only send API key if user has configured one
        if (apiKey) {
            headers['X-API-Key'] = apiKey;
        }

        // Call our Serverless Proxy (OpenRouter only)
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                prompt: promptText,
                image: base64Image,
                mimeType: mimeType,
                systemInstruction: systemInstruction,
                temperature: userTemperature,
                schema: schema,
                responseMimeType: "application/json"
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const detailedMsg = errData.details ? `${errData.error} : ${JSON.stringify(errData.details)}` : (errData.error || `Server Error: ${response.status}`);
            throw new Error(detailedMsg);
        }

        const data = await response.json();
        return data.text || "";

    } catch (error) {
        console.error("API Call Failed:", error);
        throw error;
    }
}

// =========================================================
// DATA SCHEMAS
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
// MAIN FUNCTION: Data Extraction
// =========================================================

export async function extractDataFromImage(
    base64Image: string,
    mimeType: string,
    documentType: 'tct' | 'olymel' = 'tct'
): Promise<ParsedContent> {
    console.time('DataExtraction_Total');

    const isOlymel = documentType === 'olymel';
    const headers = isOlymel ? OLYMEL_TABLE_HEADERS : TCT_TABLE_HEADERS;

    const systemInstruction = isOlymel
        ? `Tu es un extracteur de données expert pour les horaires de transport Olymel. Fidélité absolue des données requise.`
        : `Tu es un extracteur de données expert pour un logiciel de logistique. Fidélité absolue des données requise.`;

    const basePrompt = isOlymel
        ? `MODE TABLEAU TEXTE (Séparateur Pipe |).
           Analyse l'image. Extrais le tableau complet pour TOUS les jours visibles.

           RÈGLES IMPORTANTES:
           1. Format: Date | Heure | Transport | Numéro | Chauffeur
           2. RÉPÈTE la Date sur CHAQUE LIGNE (ex: "Lundi 1er déc.").
           3. Si "AUCUN TRANSPORT", écris-le dans la colonne Transport.
           4. S'il y a 2 heures (ex: "14:15\n15:15"), écris "14:15 / 15:15" dans la colonne Heure.
           5. SORTIE BRUTE UNIQUEMENT. Pas de Markdown, pas de barres décoratives au début/fin si possible.

           EXEMPLE:
           Lundi 1er déc. | 14:15 | CIRCUIT 10 | 204 | Jean Tremblay
           Lundi 1er déc. | 16:30 | AUCUN TRANSPORT OLYMEL | |
           Mardi 2 déc. | 04:00 | NAVETTE A | 305 | Pierre Paul`
        : `Analyse cette image et extrais le tableau "Affectations des tournées" en JSON valide.`;

    try {
        // Execute API call
        let initialRawText = await callOpenRouter(base64Image, mimeType, basePrompt, systemInstruction, documentType, isOlymel ? 0.1 : undefined);

        let currentEntries: any[] = [];

        if (isOlymel) {
            console.log("OLYMEL RAW TEXT (Start):", initialRawText.substring(0, 500));
            // Cleanup - Remove Code Blocks
            const cleanText = initialRawText.replace(/```(csv|json|markdown)?/gi, '').replace(/```/g, '').trim();
            const lines = cleanText.split(/\r?\n/);
            let lastDate = "";

            // Generic Line Parser (Pipe | Semicolon ; | Comma ,)
            lines.forEach(line => {
                const trimmedLine = line.trim();
                // Skip empty or separator lines
                if (trimmedLine.length < 5 || trimmedLine.match(/^[-=|]+$/)) return;

                let parts: string[] = [];
                let separator = '';

                // Detect separator
                if (trimmedLine.includes('|')) separator = '|';
                else if (trimmedLine.includes(';')) separator = ';';
                else if (trimmedLine.includes(',')) separator = ',';

                if (separator) {
                    parts = trimmedLine.split(separator).map(p => p.trim());
                } else {
                    parts = trimmedLine.split(/\s{2,}/);
                }

                // Clean boundary artifacts
                if (parts.length > 0 && parts[0] === '') parts.shift();
                if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();

                // Mapping Logic [Date, Heure, Transport, Numéro, Chauffeur]
                if (parts.length >= 3) {
                    const entry: any = {};

                    // Date Fill-Down
                    let dateVal = parts[0];
                    if (dateVal.length < 3 && lastDate.length > 3) {
                        dateVal = lastDate;
                    } else if (dateVal.length >= 3) {
                        lastDate = dateVal;
                    }
                    if (dateVal.toLowerCase().includes('date') || dateVal.toLowerCase().includes('-----')) return;

                    entry["Date"] = dateVal;
                    entry["Heure"] = parts[1] || "-";

                    // Flexible mapping
                    if (parts.length >= 5) {
                        entry["Transport"] = parts[2];
                        entry["Numéro"] = parts[3];
                        entry["Chauffeur"] = parts[4];
                    } else if (parts.length === 4) {
                        entry["Transport"] = parts[2];
                        entry["Chauffeur"] = parts[3];
                    } else {
                        entry["Transport"] = parts[2];
                        entry["Chauffeur"] = "Inconnu";
                    }

                    // Cleanups
                    if (entry["Heure"]) entry["Heure"] = entry["Heure"].replace(/\n/g, " / ");
                    if (entry["Transport"]) entry["Transport"] = entry["Transport"].replace(/\n/g, " ");

                    currentEntries.push(entry);
                }
            });

            console.log(`Olymel Parsed ${currentEntries.length} rows.`);

            // Fallback: JSON
            if (currentEntries.length === 0) {
                console.warn("Text Parse failed (0 entries). Attempting JSON parser as backup...");
                try {
                    const jsonMatch = initialRawText.match(/(\{|\[)[\s\S]*(\}|\])/);
                    if (jsonMatch) {
                        const parsedData = cleanAndParseJson(jsonMatch[0]);
                        if (Array.isArray(parsedData)) currentEntries = parsedData;
                        else if (parsedData.entries) currentEntries = parsedData.entries;
                        console.log("Fallback JSON Parser Success:", currentEntries.length, "entries found.");
                    }
                } catch (e) { console.error("Olymel JSON fallback failed", e); }
            }

            // Debug fallback
            if (currentEntries.length === 0) {
                console.error("TOTAL FAILURE. Injecting Debug Row.");
                currentEntries.push({
                    "Date": "ERREUR EXTRACTION",
                    "Heure": "00:00",
                    "Transport": "VOIR TEXTE BRUT CI-BAS",
                    "Numéro": "ERR",
                    "Chauffeur": cleanText.substring(0, 200).replace(/\n/g, " ")
                });
            }
        } else {
            // TCT JSON PARSING
            try {
                const parsedData = cleanAndParseJson(initialRawText);
                if (Array.isArray(parsedData)) {
                    currentEntries = parsedData;
                } else if (Array.isArray(parsedData.entries)) {
                    currentEntries = parsedData.entries;
                } else if (Array.isArray(parsedData.data)) {
                    currentEntries = parsedData.data;
                } else {
                    const possibleArray = Object.values(parsedData).find(val => Array.isArray(val));
                    if (possibleArray) currentEntries = possibleArray as any[];
                    else currentEntries = [];
                }
            } catch (jsonError) {
                console.warn("Broken JSON. Attempting repair...");
                const repairPrompt = "Le JSON était invalide. Génère UNIQUEMENT le JSON valide maintenant au format { \"entries\": [...] }.";
                const repairedText = await callOpenRouter(base64Image, mimeType, repairPrompt, systemInstruction, documentType, 0);
                const repairedData = cleanAndParseJson(repairedText);
                currentEntries = repairedData.entries || (Array.isArray(repairedData) ? repairedData : []);
            }
        }

        const observation = observeData(currentEntries);

        // Re-Execute (Correction) - Only for TCT with critical issues
        if (!observation.isValid && observation.issues.length > 0 && !isOlymel) {
            console.warn(`Data Quality Issues: ${observation.issues.length}`);
            const repairDataPrompt = `Corrige ces erreurs:\n${observation.issues.join('\n')}\nRenvoie le JSON complet corrigé.`;
            try {
                const correctedText = await callOpenRouter(base64Image, mimeType, repairDataPrompt, systemInstruction, documentType, 0.2);
                const correctedData = cleanAndParseJson(correctedText);
                currentEntries = correctedData.entries || (Array.isArray(correctedData) ? correctedData : currentEntries);
            } catch (e) { console.error("Correction failed, using initial data."); }
        }

        console.timeEnd('DataExtraction_Total');

        // Safety check
        if (!Array.isArray(currentEntries)) currentEntries = [];

        const rows: string[][] = currentEntries.map((entry: any) => {
            if (Array.isArray(entry)) return headers.map((_, i) => String(entry[i] || ''));
            return headers.map(header => {
                if (entry[header] !== undefined) return entry[header];
                const lowerHeader = header.toLowerCase();
                let foundKey = Object.keys(entry).find(k => k.toLowerCase() === lowerHeader);
                if (foundKey) return entry[foundKey];

                // Synonyms
                if (lowerHeader === 'transport') foundKey = Object.keys(entry).find(k => k.match(/circuit|tourn[ée]e|trajet|route/i));
                if (lowerHeader === 'numéro') foundKey = Object.keys(entry).find(k => k.match(/v[ée]hicule|bus|camion|#|no\./i));
                if (lowerHeader === 'heure') foundKey = Object.keys(entry).find(k => k.match(/d[ée]but|d[ée]part|temps|h/i));
                if (lowerHeader === 'date') foundKey = Object.keys(entry).find(k => k.match(/jour|quand/i));

                if (foundKey) return entry[foundKey];
                return '';
            });
        });

        return { headers, rows };

    } catch (error) {
        console.timeEnd('DataExtraction_Total');
        console.error("Data Extraction Fatal Error:", error);
        return { headers: ["Erreur"], rows: [[error instanceof Error ? error.message : "Erreur inconnue"]] };
    }
}
