import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_OPENROUTER_API_KEY || "");

export interface ExtractedData {
    entries: any[];
    metadata?: any;
    raw_text?: string;
}

// Olymel Columns
const OLYMEL_TABLE_HEADERS = [
    "Date", "Heure", "Transport", "Numéro", "Chauffeur"
];

// TCT Columns (Display Headers)
// Now aligned with the 14-column structure + hidden fields
export const TCT_TABLE_HEADERS = [
    "Tournée",
    "Nom",
    "Début tournée",
    "Fin tournée",
    "Classe véhicule",
    "Employé",
    "Nom de l'employé", // Will be composed of "Nom, Prénom"
    "Véhicule",
    "Classe véhicule affecté",
    "Stationnement",
    "Approuvé",
    "Territoire début",
    "Adresse de début",
    "Adresse de fin",
    "Changement",
    "Changement par"
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callAI(base64Image: string, mimeType: string, prompt: string, systemInstruction: string, documentType: string, temperature: number = 0.2): Promise<string> {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error("Clé API manquante (VITE_OPENROUTER_API_KEY). Vérifiez votre configuration.");
    }

    // Use Gemini 1.5 Flash via OpenRouter equivalent or direct
    // For this environment, we use google-generative-ai directly if key works, 
    // OR fetch via OpenRouter if configured as such.
    // The previous implementation used fetch to OpenRouter. Let's stick to that for consistency if that's what works.

    // Fallback to fetch implementation as per original file structure
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://taxi-coop-terrebonne.com",
            "X-Title": "Extracteur TCT"
        },
        body: JSON.stringify({
            "model": "google/gemini-flash-1.5-8b", // Fast and efficient for Pipe text
            "messages": [
                {
                    "role": "system",
                    "content": systemInstruction
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            "temperature": temperature,
            "max_tokens": 4000
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erreur API AI (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || "";
}

function cleanAndParseJson(text: string): any {
    try {
        // 1. Remove Markdown code blocks
        let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();

        // 2. Locate JSON object or array
        const firstBrace = clean.indexOf('{');
        const firstBracket = clean.indexOf('[');

        let start = -1;
        if (firstBrace !== -1 && firstBracket !== -1) start = Math.min(firstBrace, firstBracket);
        else if (firstBrace !== -1) start = firstBrace;
        else if (firstBracket !== -1) start = firstBracket;

        if (start !== -1) {
            clean = clean.substring(start);
            const lastBrace = clean.lastIndexOf('}');
            const lastBracket = clean.lastIndexOf(']');
            const end = Math.max(lastBrace, lastBracket);
            if (end !== -1) clean = clean.substring(0, end + 1);
        }

        return JSON.parse(clean);

    } catch (e) {
        console.warn("Initial JSON parse failed, trying relaxed parsing...", e);
        // Relaxed parser logic could go here if needed, but text mode is preferred now.
        throw new Error("NO_JSON_FOUND");
    }
}

function observeData(data: any[]): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!Array.isArray(data) || data.length === 0) return { isValid: false, issues: ["Aucune donnée extraite."] };

    // Basic heuristics
    const nullCount = data.filter(r => Object.values(r).every(v => !v)).length;
    if (nullCount > data.length / 2) issues.push("Plus de 50% des lignes sont vides.");

    return {
        isValid: issues.length === 0,
        issues
    };
}

export async function extractDataFromImage(
    base64Image: string,
    mimeType: string,
    documentType: 'olymel' | 'tct'
): Promise<ExtractedData> {

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
            console.warn("Overriding prompt for strict Pipe alignment.");
            systemInstruction = `Tu es un agent expert pour Taxi Coop Terrebonne.
Extrais les données et retourne un tableau texte avec séparateur PIPE (|).

## COLONNES (14 - Data Types STRICTS)
Tournée | Nom | Déb tour | Fin tour | Classe véh | Employé | Nom de l'employé | Véhicule | Cl véh aff | Stationnement | Approuvé | Terr début | Adresse de début | Adresse de fin

## RÈGLES DE MAPPING (CRUCIAL)
1. **Classe véh** (Col 5) : DOIT être "TAXI" ou "MINIVAN".
2. **Employé** (Col 6) : DOIT être un CHIFFRE (ID). NE METS PAS "TAXI" ICI.
3. **Nom de l'employé** (Col 7) : Juste le Nom (ex: Boivin, Patrick). PAS de chiffres.
4. **Véhicule** (Col 8) : DOIT être un CHIFFRE (ID).
5. **Approuvé** : Oui/Non.

Si un champ ne correspond pas au type, c'est que tu as décalé. CORRIGE-TOI.`;
        }
    }

    // CHANGED: BOTH Olymel AND TCT now use PIPE-SEPARATED values (|) for robustness
    const basePrompt = isOlymel
        ? `MODE TABLEAU TEXTE (Séparateur Pipe |).
           Analyse l'image. Extrais le tableau complet pour TOUS les jours visibles.
           RÈGLES:
           1. Format: Date | Heure | Transport | Numéro | Chauffeur
           2. RÉPÈTE la Date sur CHAQUE LIGNE.
           3. SORTIE BRUTE UNIQUEMENT.`
        : `MODE TABLEAU TEXTE (Séparateur Pipe |).
           Analyse l'image. aligne les données EXACTEMENT sous ces entêtes:
           
           COLONNES (14):
           Tournée | Nom | Déb tour | Fin tour | Classe véh | Employé (ID) | Nom de l'employé | Véhicule (ID) | Cl véh aff | Stationnement | Approuvé | Terr début | Adresse de début | Adresse de fin
           
           RÈGLES ANTI-DÉCALAGE:
           1. Col 5 (Classe véh) = "TAXI" ou "MINIVAN".
           2. Col 6 (Employé) = CHIFFRES UNIQUEMENT (ex: 0431). Si tu vois une lettre, c'est une erreur.
           3. Col 7 (Nom) = TEXTE (Nom, Prénom).
           4. Si une cellule est vide, laisse l'espace vide entre les pipes.
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
                    // Existing Olymel Logic
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
                    // TCT MAPPING (Based on IMAGE HEADERS - 14 Cols)
                    // 0: Tournée
                    // 1: Nom (Nom Compagnie)
                    // 2: Déb tour
                    // 3: Fin tour
                    // 4: Classe véh
                    // 5: Employé (ID)
                    // 6: Nom de l'employé (Nom, Prénom)
                    // 7: Véhicule
                    // 8: Cl véh aff
                    // 9: Stationnement
                    // 10: Approuvé (Check)
                    // 11: Terr début
                    // 12: Adresse de début
                    // 13: Adresse de fin

                    if (parts[0].toLowerCase().includes('tourn')) return; // Header skip

                    entry.tournee = parts[0];
                    entry.nom_compagnie = parts[1];
                    entry.debut_tournee = parts[2];
                    entry.fin_tournee = parts[3];
                    entry.classe_vehicule = parts[4];
                    entry.id_employe = parts[5];

                    // Smart Name Splitting logic for single column
                    const rawName = parts[6] || "";
                    if (rawName.includes(',')) {
                        const [nom, prenom] = rawName.split(',').map(s => s.trim());
                        entry.nom_employe = nom;
                        entry.prenom_employe = prenom;
                    } else if (rawName.includes(' ')) {
                        // Fallback attempt to split by space if comma is missing
                        const nameParts = rawName.split(' ');
                        entry.nom_employe = nameParts[0];
                        entry.prenom_employe = nameParts.slice(1).join(' ');
                    } else {
                        entry.nom_employe = rawName;
                        entry.prenom_employe = "";
                    }

                    entry.vehicule = parts[7];
                    entry.classe_vehicule_affecte = parts[8];
                    entry.stationnement = parts[9];

                    // Handle Boolean
                    const rawAppr = (parts[10] || "").toLowerCase();
                    entry.approuve = rawAppr.includes('oui') || rawAppr.includes('true') || rawAppr.includes('x') || rawAppr === 'o';

                    entry.territoire_debut = parts[11];
                    entry.adresse_debut = parts[12];
                    entry.adresse_fin = parts[13];

                    // Not in Image, leave empty
                    entry.changement = "";
                    entry.changement_par = "";

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
            // Keep existing JSON logic as fallback
            try {
                const parsedData = cleanAndParseJson(initialRawText);
                if (Array.isArray(parsedData)) currentEntries = parsedData;
                else if (parsedData.entries) currentEntries = parsedData.entries;
                else if (parsedData.data) currentEntries = parsedData.data;
            } catch (e) { console.error("JSON Fallback failed", e); }
        }

        // Step 3: Observe (Content)
        const observation = observeData(currentEntries);

        // Step 4: Strategize & Re-Execute (Correction) - Only if critical
        if (!observation.isValid && observation.issues.length > 0 && !isOlymel) {
            console.warn(`Data Quality Issues: ${observation.issues.length}`);
            // Retry logic could go here
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
                    return "";
                }
                if (header === "Véhicule" && entry.vehicule) return entry.vehicule;
                if (header === "Classe véhicule affecté" && entry.classe_vehicule_affecte) return entry.classe_vehicule_affecte;
                if (header === "Stationnement" && entry.stationnement) return entry.stationnement;
                if (header === "Approuvé") return entry.approuve ? "Oui" : "Non";
                if (header === "Territoire début" && entry.territoire_debut) return entry.territoire_debut;
                if (header === "Adresse de début" && entry.adresse_debut) return entry.adresse_debut;
                if (header === "Adresse de fin" && entry.adresse_fin) return entry.adresse_fin;
                if (header === "Changement" && entry.changement) return entry.changement;
                if (header === "Changement par" && entry.changement_par) return entry.changement_par;

                return "";
            });
        });

        // Add Headers if not present
        return {
            entries: rows,
            raw_text: initialRawText
        };

    } catch (error: any) {
        console.error("AI Error:", error);
        throw error;
    }
}
