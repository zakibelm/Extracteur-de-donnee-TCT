
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

async function callAI(
    base64Image: string,
    mimeType: string,
    promptText: string,
    systemInstruction: string,
    documentType: 'tct' | 'olymel' = 'tct',
    temperature: number = 0.1
): Promise<string> {

    // Select correct schema
    // Disable Strict Schema for both to allow System Prompt to define structure (EVV / Custom)
    const schema = undefined;

    // Retrieve settings from localStorage
    const storedApiKey = localStorage.getItem('adt_settings_apikey');
    const storedModel = localStorage.getItem('adt_settings_model');
    // RAG setting is stored but not currently used in the API call logic directly 
    // const enableRag = localStorage.getItem('adt_settings_rag') === 'true';

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (storedApiKey) {
        headers['X-API-Key'] = storedApiKey;
    }

    if (storedModel) {
        headers['X-Model'] = storedModel;
    }

    try {
        // Call our Secure Serverless Proxy
        const response = await fetch('/api/extract', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                prompt: promptText,
                image: base64Image,
                mimeType: mimeType,
                systemInstruction: systemInstruction,
                temperature: temperature,
                schema: schema,
                responseMimeType: "application/json" // ALWAYS force JSON mode, even if schema is loose
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
// DATA SCHEMAS (Defined locally for best performance)
// =========================================================

// TCT Schema
const TCT_TABLE_HEADERS = [
    "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
    "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
    "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin",
    "Changement", "Changement par"
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

    // Load custom prompts from localStorage if available
    const storedTctPrompt = localStorage.getItem('adt_settings_prompt_tct');
    const storedOlymelPrompt = localStorage.getItem('adt_settings_prompt_olymel');

    let systemInstruction = "";

    if (isOlymel) {
        systemInstruction = storedOlymelPrompt && storedOlymelPrompt.trim() !== ""
            ? storedOlymelPrompt
            : `Tu es un extracteur de données expert pour les horaires de transport Olymel. Fidélité absolue des données requise.`;
    } else {
        systemInstruction = storedTctPrompt && storedTctPrompt.trim() !== ""
            ? storedTctPrompt
            : `Tu es un extracteur de données expert pour un logiciel de logistique. Fidélité absolue des données requise.`;
    }

    // CHANGED: Olymel Prompt now asks for PIPE-SEPARATED values (|)
    // This is often more reliable for LLMs than CSV/JSON against confusing layouts
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
        // Step 1: Execute
        let initialRawText = await callAI(base64Image, mimeType, basePrompt, systemInstruction, documentType, isOlymel ? 0.1 : undefined);

        let currentEntries: any[] = [];

        if (isOlymel) {
            console.log("OLYMEL RAW TEXT (Start):", initialRawText.substring(0, 500));
            // 1. CLEANUP (Remove Code Blocks)
            const cleanText = initialRawText.replace(/```(csv|json|markdown)?/gi, '').replace(/```/g, '').trim();
            const lines = cleanText.split(/\r?\n/); // Handle various newlines
            let lastDate = "";

            // 2. STRATEGY: GENERIC LINE PARSER (Pipe | Semicolon ; | Comma ,)
            lines.forEach(line => {
                const trimmedLine = line.trim();
                // Skip empty or separator lines like "---|---"
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
                    // Try to split by multiple spaces as last resort
                    parts = trimmedLine.split(/\s{2,}/);
                }

                // Filter out empty parts artifacts from splitting (e.g. "| value |" -> ["", "value", ""])
                // But keep internal empty fields
                // Actually, map(trim) keeps empty strings as "". We should just strip leading/trailing emptiness if it comes from the boundary.
                if (parts.length > 0 && parts[0] === '') parts.shift();
                if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();

                // Mapping Logic (Heuristic typically 5 columns)
                // [Date, Heure, Transport, Numéro, Chauffeur]
                if (parts.length >= 3) {
                    const entry: any = {};

                    // Date Fill-Down
                    let dateVal = parts[0];
                    if (dateVal.length < 3 && lastDate.length > 3) {
                        dateVal = lastDate;
                    } else if (dateVal.length >= 3) {
                        lastDate = dateVal;
                    }
                    if (dateVal.toLowerCase().includes('date') || dateVal.toLowerCase().includes('-----')) return; // Header skip

                    entry["Date"] = dateVal;
                    entry["Heure"] = parts[1] || "-";

                    // Flexible mapping for remaining cols
                    if (parts.length >= 5) {
                        entry["Transport"] = parts[2];
                        entry["Numéro"] = parts[3];
                        entry["Chauffeur"] = parts[4];
                    } else if (parts.length === 4) {
                        entry["Transport"] = parts[2];
                        entry["Chauffeur"] = parts[3]; // Numéro often skipped/merged
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

            // 3. FALLBACK: JSON (If raw text was actually JSON)
            // We relaxed the check to include '[' for arrays, and we try it if we have 0 entries regardless of start char
            if (currentEntries.length === 0) {
                console.warn("Text Parse failed (0 entries). Attempting JSON parser as backup...");
                try {
                    // Try to find ANY JSON-like structure
                    const jsonMatch = initialRawText.match(/(\{|\[)[\s\S]*(\}|\])/);
                    if (jsonMatch) {
                        const parsedData = cleanAndParseJson(jsonMatch[0]);
                        if (Array.isArray(parsedData)) currentEntries = parsedData;
                        else if (parsedData.entries) currentEntries = parsedData.entries;
                        console.log("Fallback JSON Parser Success:", currentEntries.length, "entries found.");
                    }
                } catch (e) { console.error("Olymel JSON fallback failed", e); }
            }

            // 4. ULTIMATE DEBUG FALLBACK
            // If we STILL have 0 entries, inject a dummy row with the raw text so the user sees SOMETHING.
            if (currentEntries.length === 0) {
                console.error("TOTAL FAILURE. Injecting Debug Row.");
                currentEntries.push({
                    "Date": "ERREUR EXTRACTION",
                    "Heure": "00:00",
                    "Transport": "VOIR TEXTE BRUT CI-BAS",
                    "Numéro": "ERR",
                    "Chauffeur": cleanText.substring(0, 200).replace(/\n/g, " ") // Show first 200 chars
                });
            }
        } else {
            // TCT JSON PARSING LOGIC (UNCHANGED)
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
                const repairedText = await callAI(base64Image, mimeType, repairPrompt, systemInstruction, documentType, 0);
                const repairedData = cleanAndParseJson(repairedText);
                currentEntries = repairedData.entries || (Array.isArray(repairedData) ? repairedData : []);
            }
        }

        // Step 3: Observe (Content)
        // [Old CSV Fallback block removed as new strategy covers it]

        const observation = observeData(currentEntries);

        // Step 4: Strategize & Re-Execute (Correction) - Only if critical
        if (!observation.isValid && observation.issues.length > 0 && !isOlymel) {
            // Only retry TCT (JSON) for now, Olymel allows loose text
            console.warn(`Data Quality Issues: ${observation.issues.length}`);
            const repairDataPrompt = `Corrige ces erreurs:\n${observation.issues.join('\n')}\nRenvoie le JSON complet corrigé.`;
            try {
                const correctedText = await callAI(base64Image, mimeType, repairDataPrompt, systemInstruction, documentType, 0.2);
                const correctedData = cleanAndParseJson(correctedText);
                currentEntries = correctedData.entries || (Array.isArray(correctedData) ? correctedData : currentEntries);
            } catch (e) { console.error("Correction failed, using initial data."); }
        }

        console.timeEnd('ObserveExecute_Total');

        // SAFETY CHECK
        if (!Array.isArray(currentEntries)) currentEntries = [];

        const rows: string[][] = currentEntries.map((entry: any) => {
            if (Array.isArray(entry)) return headers.map((_, i) => String(entry[i] || ''));

            return headers.map(header => {
                // 1. Direct Match
                if (entry[header] !== undefined) return String(entry[header]);

                // 2. Case Insensitive Match
                const lowerHeader = header.toLowerCase();
                let foundKey = Object.keys(entry).find(k => k.toLowerCase() === lowerHeader);
                if (foundKey) return String(entry[foundKey]);

                // 3. EVV Schema Mapping (Snake Case from new Prompt)
                if (header === "Tournée" && entry.tournee) return entry.tournee;
                if (header === "Nom" && entry.nom_compagnie) return entry.nom_compagnie;
                if (header === "Début tournée" && entry.debut_tournee) return entry.debut_tournee;
                if (header === "Fin tournée" && entry.fin_tournee) return entry.fin_tournee;
                if (header === "Classe véhicule" && entry.classe_vehicule) return entry.classe_vehicule;
                if (header === "Employé" && entry.id_employe) return entry.id_employe;
                if (header === "Nom de l'employé") {
                    if (entry.nom_employe && entry.prenom_employe) return `${entry.nom_employe}, ${entry.prenom_employe}`;
                    if (entry.nom_employe) return entry.nom_employe;
                }
                if (header === "Véhicule" && entry.vehicule) return entry.vehicule;
                if (header === "Classe véhicule affecté" && entry.classe_vehicule_affecte) return entry.classe_vehicule_affecte;
                if (header === "Stationnement" && entry.stationnement) return entry.stationnement;
                if (header === "Approuvé") {
                    if (entry.approuve !== undefined) return entry.approuve === true || entry.approuve === 'true' ? 'Oui' : 'Non';
                }
                if (header === "Territoire début" && entry.territoire_debut) return entry.territoire_debut;
                if (header === "Adresse de début" && (entry.adresse_debut || entry.adresse_depart)) return entry.adresse_debut || entry.adresse_depart;
                if (header === "Adresse de fin" && (entry.adresse_fin || entry.adresse_arrivee)) return entry.adresse_fin || entry.adresse_arrivee;
                if (header === "Changement" && entry.changement) return entry.changement;
                if (header === "Changement par" && entry.changement_par) return entry.changement_par;

                // 4. Fuzzy / Synonym Match (Legacy)
                if (lowerHeader === 'transport') foundKey = Object.keys(entry).find(k => k.match(/circuit|tourn[ée]e|trajet|route/i));
                if (lowerHeader === 'numéro') foundKey = Object.keys(entry).find(k => k.match(/v[ée]hicule|bus|camion|#|no\./i));
                if (lowerHeader === 'heure') foundKey = Object.keys(entry).find(k => k.match(/d[ée]but|d[ée]part|temps|h/i));
                if (lowerHeader === 'date') foundKey = Object.keys(entry).find(k => k.match(/jour|quand/i));

                if (foundKey) return String(entry[foundKey]);
                return ''; // Empty if not found
            });
        });

        return { headers, rows };

    } catch (error) {
        console.timeEnd('ObserveExecute_Total');
        console.error("Gemini Extraction Fatal Error:", error);
        return { headers: ["Erreur"], rows: [[error instanceof Error ? error.message : "Erreur inconnue"]] };
    }
}
