
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

    // Load custom prompts from localStorage
    const storedTctPrompt = localStorage.getItem('adt_settings_prompt_tct');
    const storedOlymelPrompt = localStorage.getItem('adt_settings_prompt_olymel');

    let systemInstruction = "";

    if (isOlymel) {
        systemInstruction = storedOlymelPrompt && storedOlymelPrompt.trim() !== ""
            ? storedOlymelPrompt
            : `Tu es un extracteur de données expert pour les horaires de transport Olymel. Fidélité absolue des données requise.`;
    } else {
        // TCT LOGIC: Force Pipe Mode compatibility
        // If the user has an old "JSON" prompt stored, it will BREAK the new Pipe strategy.
        // We detect this and override it with the correct Pipe prompt.
        const likelyJsonPrompt = storedTctPrompt && (storedTctPrompt.toLowerCase().includes('json') || storedTctPrompt.includes('{'));

        if (storedTctPrompt && storedTctPrompt.trim() !== "" && !likelyJsonPrompt) {
            systemInstruction = storedTctPrompt;
        } else {
            if (likelyJsonPrompt) console.warn("Overriding user's JSON Prompt to enforce Pipe Strategy.");
            systemInstruction = `Tu es un agent expert pour Taxi Coop Terrebonne.
Extrais les données du tableau et retourne UNIQUEMENT un tableau texte avec séparateur PIPE (|).

## FORMAT DE SORTIE OBLIGATOIRE (Respecte l'ordre)
Tournée | Nom Compagnie | Début | Fin | Classe V. | ID Employé | Nom Employé | Prénom Employé | Véhicule | Classe V. Affecté | Stationnement | Approuvé | Territoire | Adresse Début | Adresse Fin | Changement | Changement Par

## RÈGLES CRITIQUES
1. **UNE SEULE LIGNE PAR TOURNÉE.**
2. Si une cellule est vide, laisse l'espace vide (ex: ...| |...).
3. **Approuvé** : Si coché (✓/Oui) = true, Sinon = false.
4. **Noms** : Sépare bien Nom et Prénom.
5. **PAS DE MARKDOWN** (pas de tableau ASCII). Juste les données brutes.`;
        }
    }

    // CHANGED: BOTH Olymel AND TCT now use PIPE-SEPARATED values (|) for robustness
    // This solves "JSON Limits" (truncation) and "Shifted Columns" (misalignment)
    const basePrompt = isOlymel
        ? `MODE TABLEAU TEXTE (Séparateur Pipe |).
           Analyse l'image. Extrais le tableau complet pour TOUS les jours visibles.
           RÈGLES:
           1. Format: Date | Heure | Transport | Numéro | Chauffeur
           2. RÉPÈTE la Date sur CHAQUE LIGNE.
           3. SORTIE BRUTE UNIQUEMENT.`
        : `MODE TABLEAU TEXTE (Séparateur Pipe |).
           Analyse l'image. Extrais le tableau "Affectations des tournées" complet.
           
           RÈGLES CRITIQUES:
           1. FORMAT LIGNE: Tournée | Nom Compagnie | Début | Fin | Classe V. | ID Employé | Nom Employé | Prénom Employé | Véhicule | Classe V. Affecté | Stationnement | Approuvé (Oui/Non) | Territoire | Adresse Début | Adresse Fin | Changement | Changement Par
           2. Une ligne par tournée.
           3. Si une cellule est vide, laisse l'espace vide entre les pipes (ex: | |).
           4. Sépare bien Nom et Prénom.
           5. SORTIE BRUTE UNIQUEMENT.`;

    try {
        // Step 1: Execute
        let initialRawText = await callAI(base64Image, mimeType, basePrompt, systemInstruction, documentType, 0.1); // Low temp for precision

        let currentEntries: any[] = [];

        // UNIFIED PARSING LOGIC (Text/Pipe First)
        console.log(`${documentType} RAW TEXT:`, initialRawText.substring(0, 500));

        const cleanText = initialRawText.replace(/```(csv|json|markdown)?/gi, '').replace(/```/g, '').trim();
        const lines = cleanText.split(/\r?\n/);
        let lastDate = ""; // Only used for Olymel

        // Detect if we have mostly JSON or Text
        const isJsonLike = cleanText.startsWith('{') || cleanText.startsWith('[');

        if (!isJsonLike) {
            lines.forEach(line => {
                const trimmedLine = line.trim();
                // Skip separating lines or empty lines
                if (trimmedLine.length < 5 || trimmedLine.match(/^[-=|]+$/)) return;

                // Heuristic: Must have at least a few separators to be a valid row
                if (!trimmedLine.includes('|')) return;

                const parts = trimmedLine.split('|').map(p => p.trim());
                // Remove edge empty parts if they exist (e.g. "| col1 | ... |")
                if (parts.length > 0 && parts[0] === '') parts.shift();
                if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();

                const entry: any = {};

                if (isOlymel) {
                    // ... (Existing Olymel Logic - Kept minimal here for diff context, but in practice I should probably not delete it if I can avoid it)
                    // Re-implementing Olymel mapping briefly to keep file valid:
                    if (parts.length >= 3) {
                        let dateVal = parts[0];
                        if (dateVal.length < 3 && lastDate.length > 3) dateVal = lastDate;
                        else if (dateVal.length >= 3) lastDate = dateVal;
                        if (dateVal.toLowerCase().includes('date') || dateVal.toLowerCase().includes('-----')) return;

                        entry["Date"] = dateVal;
                        entry["Heure"] = parts[1] || "-";
                        entry["Transport"] = parts[2] || "";
                        entry["Numéro"] = parts[3] || "";
                        entry["Chauffeur"] = parts[4] || "";
                        currentEntries.push(entry);
                    }
                } else {
                    // TCT MAPPING (Based on the new Base Prompt)
                    // Format: Tournée | Nom | Début | Fin | Classe V | ID | Nom | Prénom | Véhicule | ...
                    // Headers Ref: 
                    // 0: Tournée, 1: Nom, 2: Début, 3: Fin, 4: Classe V, 5: ID, 6: Nom, 7: Prénom, 
                    // 8: Véhicule, 9: Classe V Aff, 10: Station, 11: Appr, 12: Terr, 13: Adr Deb, 14: Adr Fin, 15: Chg, 16: Chg Par

                    if (parts[0].toLowerCase().includes('tourn')) return; // Header skip

                    entry.tournee = parts[0];
                    entry.nom_compagnie = parts[1];
                    entry.debut_tournee = parts[2];
                    entry.fin_tournee = parts[3];
                    entry.classe_vehicule = parts[4];
                    entry.id_employe = parts[5];
                    entry.nom_employe = parts[6];
                    entry.prenom_employe = parts[7];
                    entry.vehicule = parts[8];
                    entry.classe_vehicule_affecte = parts[9];
                    entry.stationnement = parts[10];
                    entry.approuve = parts[11];
                    entry.territoire_debut = parts[12];
                    entry.adresse_debut = parts[13];
                    entry.adresse_fin = parts[14];
                    entry.changement = parts[15];
                    entry.changement_par = parts[16];

                    // Check if mostly empty (invalid row)
                    if (Object.values(entry).filter(v => v !== "").length > 2) {
                        currentEntries.push(entry);
                    }
                }
            });
            console.log(`Parsed ${currentEntries.length} rows (Pipe Mode).`);
        }

        // Fallback or JSON Logic
        if (isJsonLike || currentEntries.length === 0) {
            // ... (Keep existing JSON logic as fallback)
            try {
                const parsedData = cleanAndParseJson(initialRawText);
                // ... (Existing array extraction)
                if (Array.isArray(parsedData)) currentEntries = parsedData;
                else if (parsedData.entries) currentEntries = parsedData.entries;
                else if (parsedData.data) currentEntries = parsedData.data;
            } catch (e) { console.error("JSON Fallback failed", e); }
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
