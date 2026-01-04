/**
 * Unified AI Service - Single source for AI extraction logic
 * Replaces geminiService.ts and aiService.ts duplication
 */

import { ParsedContent } from '../types';

// =========================================================
// SCHEMAS & HEADERS
// =========================================================

export const DOCUMENT_CONFIGS = {
    tct: {
        headers: [
            "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
            "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
            "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin"
        ],
        schema: {
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
                        required: [
                            "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
                            "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
                            "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin"
                        ]
                    }
                }
            },
            required: ["entries"],
        },
        systemPrompt: `Tu es un extracteur de données expert pour un logiciel de logistique.
Ta priorité absolue est la fidélité des données : ne jamais inventer d'informations.
Si une case est vide, laisse la valeur vide "".`,
        extractionPrompt: `Analyse cette image et extrais le tableau "Affectations des tournées" en JSON valide.
Retourne UNIQUEMENT un JSON respectant strictement le schéma fourni.
Assure-toi de bien distinguer les caractères ambigus (ex: 0 vs O, 1 vs I).
Pour les dates/heures, essaie de garder une cohérence verticale (format identique pour toute la colonne si possible).`
    },
    olymel: {
        headers: ["Date", "Heure", "Transport", "Numéro", "Chauffeur"],
        schema: undefined, // Olymel uses text parsing, not JSON schema
        systemPrompt: `Tu es un extracteur de données expert pour les horaires de transport Olymel.
Fidélité absolue des données requise.`,
        extractionPrompt: `MODE TABLEAU TEXTE (Séparateur Pipe |).
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
    }
};

// =========================================================
// VALIDATION LAYER
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

function observeData(entries: Record<string, string>[], documentType: 'tct' | 'olymel'): ValidationResult {
    const issues: string[] = [];
    let invalidCount = 0;
    let criticalErrors = 0;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return { isValid: true, hasCriticalErrors: false, issues: [] };
    }

    // Skip validation for Olymel (text-based)
    if (documentType === 'olymel') {
        return { isValid: true, hasCriticalErrors: false, issues: [] };
    }

    // TCT Validation
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
// UTILITIES
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
// API LAYER
// =========================================================

export interface ExtractionOptions {
    apiKey?: string;
    model?: string;
    systemPrompt?: string;
}

async function callAI(
    base64Image: string,
    mimeType: string,
    promptText: string,
    systemInstruction: string,
    documentType: 'tct' | 'olymel',
    temperature: number = 0.1,
    options?: ExtractionOptions
): Promise<string> {
    const config = DOCUMENT_CONFIGS[documentType];
    const schema = config.schema;

    try {
        const response = await fetch('/api/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(options?.apiKey && { 'X-API-Key': options.apiKey }),
                ...(options?.model && { 'X-Model': options.model })
            },
            body: JSON.stringify({
                prompt: promptText,
                image: base64Image,
                mimeType,
                systemInstruction: options?.systemPrompt || systemInstruction,
                temperature,
                schema,
                responseMimeType: schema ? "application/json" : undefined
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erreur API inconnue');
        }

        const data = await response.json();
        return data.text || "";

    } catch (e: any) {
        console.error("Erreur Appel API:", e);
        throw e;
    }
}

// =========================================================
// OLYMEL TEXT PARSER
// =========================================================

function parseOlymelText(rawText: string): any[] {
    const cleanText = rawText.replace(/```(csv|json|markdown)?/gi, '').replace(/```/g, '').trim();
    const lines = cleanText.split(/\r?\n/);
    let lastDate = "";
    const entries: any[] = [];

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.length < 5 || trimmedLine.match(/^[-=|]+$/)) return;

        let parts: string[] = [];
        let separator = '';

        if (trimmedLine.includes('|')) separator = '|';
        else if (trimmedLine.includes(';')) separator = ';';
        else if (trimmedLine.includes(',')) separator = ',';

        if (separator) {
            parts = trimmedLine.split(separator).map(p => p.trim());
        } else {
            parts = trimmedLine.split(/\s{2,}/);
        }

        if (parts.length > 0 && parts[0] === '') parts.shift();
        if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();

        if (parts.length >= 3) {
            const entry: any = {};

            let dateVal = parts[0];
            if (dateVal.length < 3 && lastDate.length > 3) {
                dateVal = lastDate;
            } else if (dateVal.length >= 3) {
                lastDate = dateVal;
            }
            if (dateVal.toLowerCase().includes('date') || dateVal.toLowerCase().includes('-----')) return;

            entry["Date"] = dateVal;
            entry["Heure"] = parts[1] || "-";

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

            if (entry["Heure"]) entry["Heure"] = entry["Heure"].replace(/\n/g, " / ");
            if (entry["Transport"]) entry["Transport"] = entry["Transport"].replace(/\n/g, " ");

            entries.push(entry);
        }
    });

    return entries;
}

// =========================================================
// MAIN EXTRACTION FUNCTION
// =========================================================

export async function extractDataFromImage(
    base64Image: string,
    mimeType: string,
    documentType: 'tct' | 'olymel' = 'tct',
    options?: ExtractionOptions
): Promise<ParsedContent> {
    console.time('UnifiedAI_Extraction');

    const config = DOCUMENT_CONFIGS[documentType];
    const systemInstruction = options?.systemPrompt || config.systemPrompt;
    const basePrompt = config.extractionPrompt;

    try {
        // Step 1: Initial Extraction
        const initialRawText = await callAI(base64Image, mimeType, basePrompt, systemInstruction, documentType, 0.1, options);
        let currentEntries: any[] = [];

        if (documentType === 'olymel') {
            // Olymel: Parse text-based output
            currentEntries = parseOlymelText(initialRawText);

            // Fallback to JSON if text parsing fails
            if (currentEntries.length === 0) {
                try {
                    const jsonMatch = initialRawText.match(/(\{|\[)[\s\S]*(\}|\])/);
                    if (jsonMatch) {
                        const parsedData = cleanAndParseJson(jsonMatch[0]);
                        if (Array.isArray(parsedData)) currentEntries = parsedData;
                        else if (parsedData.entries) currentEntries = parsedData.entries;
                    }
                } catch (e) {
                    console.error("Olymel JSON fallback failed", e);
                }
            }

            // Ultimate fallback
            if (currentEntries.length === 0) {
                currentEntries.push({
                    "Date": "ERREUR EXTRACTION",
                    "Heure": "00:00",
                    "Transport": "Échec de l'extraction - Vérifier l'image",
                    "Numéro": "ERR",
                    "Chauffeur": "N/A"
                });
            }
        } else {
            // TCT: JSON-based output
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
                const repairedText = await callAI(base64Image, mimeType, repairPrompt, systemInstruction, documentType, 0, options);
                const repairedData = cleanAndParseJson(repairedText);
                currentEntries = repairedData.entries || (Array.isArray(repairedData) ? repairedData : []);
            }
        }

        // Step 2: Validation & Correction (TCT only)
        const observation = observeData(currentEntries, documentType);

        if (!observation.isValid && observation.issues.length > 0 && documentType === 'tct') {
            console.warn(`Data Quality Issues: ${observation.issues.length}`);
            const repairDataPrompt = `Corrige ces erreurs:\n${observation.issues.join('\n')}\nRenvoie le JSON complet corrigé.`;
            try {
                const correctedText = await callAI(base64Image, mimeType, repairDataPrompt, systemInstruction, documentType, 0.2, options);
                const correctedData = cleanAndParseJson(correctedText);
                currentEntries = correctedData.entries || (Array.isArray(correctedData) ? correctedData : currentEntries);
            } catch (e) {
                console.error("Correction failed, using initial data.");
            }
        }

        console.timeEnd('UnifiedAI_Extraction');

        // Safety check
        if (!Array.isArray(currentEntries)) currentEntries = [];

        // Map to rows
        const rows: string[][] = currentEntries.map((entry: any) => {
            if (Array.isArray(entry)) return config.headers.map((_, i) => String(entry[i] || ''));
            return config.headers.map(header => {
                if (entry[header] !== undefined) return entry[header];
                const lowerHeader = header.toLowerCase();
                let foundKey = Object.keys(entry).find(k => k.toLowerCase() === lowerHeader);
                if (foundKey) return entry[foundKey];

                // Synonyms for Olymel
                if (lowerHeader === 'transport') foundKey = Object.keys(entry).find(k => k.match(/circuit|tourn[ée]e|trajet|route/i));
                if (lowerHeader === 'numéro') foundKey = Object.keys(entry).find(k => k.match(/v[ée]hicule|bus|camion|#|no\./i));
                if (lowerHeader === 'heure') foundKey = Object.keys(entry).find(k => k.match(/d[ée]but|d[ée]part|temps|h/i));
                if (lowerHeader === 'date') foundKey = Object.keys(entry).find(k => k.match(/jour|quand/i));

                if (foundKey) return entry[foundKey];
                return '';
            });
        });

        return { headers: config.headers, rows };

    } catch (error) {
        console.timeEnd('UnifiedAI_Extraction');
        console.error("AI Extraction Fatal Error:", error);
        return { headers: ["Erreur"], rows: [[error instanceof Error ? error.message : "Erreur inconnue"]] };
    }
}
