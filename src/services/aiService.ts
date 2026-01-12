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

// TCT Columns (17 Columns - Structure Réelle)
export const TCT_TABLE_HEADERS = [
    "Tournée",
    "Nom",
    "Début tournée",
    "Fin tournée",
    "Classe véhicule",
    "Employé",
    "Nom de l'employé",
    "Employé (Confirm)",
    "Véhicule",
    "Classe véhicule affecté",
    "Autoris",
    "Approuvé",
    "Retour",
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

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://taxi-coop-terrebonne.com",
            "X-Title": "Extracteur TCT"
        },
        body: JSON.stringify({
            "model": "google/gemini-flash-1.5-8b",
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
        let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
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
        throw new Error("NO_JSON_FOUND");
    }
}

function observeData(data: any[]): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!Array.isArray(data) || data.length === 0) return { isValid: false, issues: ["Aucune donnée extraite."] };
    const nullCount = data.filter(r => Object.values(r).every(v => !v)).length;
    if (nullCount > data.length / 2) issues.push("Plus de 50% des lignes sont vides.");
    return { isValid: issues.length === 0, issues };
}

export async function extractDataFromImage(base64Image: string, mimeType: string, documentType: 'olymel' | 'tct'): Promise<ExtractedData> {
    console.time('ObserveExecute_Total');

    const isOlymel = documentType === 'olymel';
    const headers = isOlymel ? OLYMEL_TABLE_HEADERS : TCT_TABLE_HEADERS;

    const storedTctPrompt = localStorage.getItem('adt_settings_prompt_tct');
    const storedOlymelPrompt = localStorage.getItem('adt_settings_prompt_olymel');

    let systemInstruction = "";

    if (isOlymel) {
        systemInstruction = storedOlymelPrompt && storedOlymelPrompt.trim() !== ""
            ? storedOlymelPrompt
            : `Tu es un extracteur de données expert pour les horaires de transport Olymel.`;
    } else {
        const likelyJsonPrompt = storedTctPrompt && (storedTctPrompt.toLowerCase().includes('json') || storedTctPrompt.includes('{'));

        if (storedTctPrompt && storedTctPrompt.trim() !== "" && !likelyJsonPrompt) {
            systemInstruction = storedTctPrompt;
        } else {
            console.warn("Using Standard 17-col TCT Prompt.");
            systemInstruction = `Tu es un agent expert pour Taxi Coop Terrebonne.
Extrais les données et retourne un tableau texte avec séparateur PIPE (|).

## STRUCTURE EXACTE (17 COLONNES)
1. Tournée
2. Nom (TAXI COOP...)
3. Déb tour
4. Fin tour
5. Cl véh
6. Employé (ID)
7. Nom de l'employé
8. Employé (ID Confirm)
9. Véhicule
10. Cl véh aff
11. Autoris
12. Approuvé
13. Retour
14. Adresse de début
15. Adresse de fin
16. Changement (DOME)
17. Changement par (DOME)

## IMPORTANT
- Conserve l'ordre exact.
- Retourne des valeurs vides si absent.
- Changement/Changement par sont des numéros.`;
        }
    }

    const basePrompt = isOlymel
        ? `MODE TABLEAU TEXTE (Séparateur Pipe |).`
        : `MODE TABLEAU TEXTE (Séparateur Pipe |).
           Analyse l'image. Extrais les 17 colonnes pour chaque tournée.
           Si une colonne est vide, laisse l'espace vide entre les pipes.
           Attends-toi à une double colonne Employé (col 6 et 8).
           SORTIE BRUTE UNIQUEMENT.`;

    try {
        let initialRawText = await callAI(base64Image, mimeType, basePrompt, systemInstruction, documentType, 0.1);
        console.log(`${documentType} RAW TEXT:`, initialRawText.substring(0, 500));

        let currentEntries: any[] = [];
        const cleanText = initialRawText.replace(/```(csv|json|markdown)?/gi, '').replace(/```/g, '').trim();
        const lines = cleanText.split(/\r?\n/);
        let lastDate = "";
        const isJsonLike = cleanText.startsWith('{') || cleanText.startsWith('[');

        if (!isJsonLike) {
            lines.forEach(line => {
                const trimmedLine = line.trim();
                // Skip short lines or separator lines
                if (trimmedLine.length < 5 || trimmedLine.match(/^[-=|]+$/)) return;
                if (!trimmedLine.includes('|')) return;

                const parts = trimmedLine.split('|').map(p => p.trim());
                // Handle leading/trailing pipe emptiness
                if (parts.length > 0 && parts[0] === '') parts.shift();
                if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();

                const entry: any = {};

                if (isOlymel) {
                    // ... (Olymel logic unchanged)
                    if (parts.length >= 3) {
                        let dateVal = parts[0];
                        if (dateVal.length < 3 && lastDate.length > 3) dateVal = lastDate;
                        else if (dateVal.length >= 3) lastDate = dateVal;
                        currentEntries.push(entry);
                    }
                } else {
                    // TCT MAPPING (17 COLUMNS scheme)
                    if (parts[0].toLowerCase().includes('tourn')) return;

                    // 1. Tournée
                    entry.tournee = parts[0] || "";
                    // 2. Nom
                    entry.nom_compagnie = parts[1] || "";
                    // 3. Déb tour
                    entry.debut_tournee = parts[2] || "";
                    // 4. Fin tour
                    entry.fin_tournee = parts[3] || "";
                    // 5. Cl véh
                    entry.classe_vehicule = parts[4] || "";
                    // 6. Employé (ID)
                    entry.id_employe = parts[5] || "";
                    // 7. Nom de l'employé
                    const rawName = parts[6] || "";
                    if (rawName.includes(',')) {
                        const [nom, prenom] = rawName.split(',').map(s => s.trim());
                        entry.nom_employe = nom;
                        entry.prenom_employe = prenom;
                    } else {
                        entry.nom_employe = rawName;
                        entry.prenom_employe = "";
                    }
                    // 8. Employé (Confirm) - Optional usage
                    entry.id_employe_confirm = parts[7] || "";

                    // 9. Véhicule
                    entry.vehicule = parts[8] || "";
                    // 10. Cl véh aff
                    entry.classe_vehicule_affecte = parts[9] || "";
                    // 11. Autoris
                    entry.autoris = parts[10] || "";

                    // 12. Approuvé
                    const rawAppr = (parts[11] || "").toLowerCase();
                    entry.approuve = rawAppr.includes('oui') || rawAppr.includes('true') || rawAppr.includes('x') || rawAppr === 'o';

                    // 13. Retour
                    const rawRetour = (parts[12] || "").toLowerCase();
                    entry.retour = rawRetour.includes('oui') || rawRetour.includes('true') || rawRetour.includes('x');

                    // 14. Adresse début
                    entry.adresse_debut = parts[13] || "";
                    // 15. Adresse fin
                    entry.adresse_fin = parts[14] || "";

                    // 16. Changement
                    entry.changement = parts[15] || "";
                    // 17. Changement par
                    entry.changement_par = parts[16] || "";

                    if (Object.values(entry).filter(v => v !== "").length > 2) {
                        currentEntries.push(entry);
                    }
                }
            });
            console.log(`Parsed ${currentEntries.length} rows (17-Col Mode).`);
        }

        if (isJsonLike || currentEntries.length === 0) {
            try {
                const parsedData = cleanAndParseJson(initialRawText);
                if (Array.isArray(parsedData)) currentEntries = parsedData;
                else if (parsedData.entries) currentEntries = parsedData.entries;
                else if (parsedData.data) currentEntries = parsedData.data;
                // If json is used, map snake_case or new keys to flat entry
            } catch (e) { console.error("JSON Fallback failed", e); }
        }

        const observation = observeData(currentEntries);

        console.timeEnd('ObserveExecute_Total');

        if (!Array.isArray(currentEntries)) currentEntries = [];

        const rows: string[][] = currentEntries.map((entry: any) => {
            if (Array.isArray(entry)) {
                // Return straight array if already array
                return headers.map((_, i) => String(entry[i] || ''));
            }

            return headers.map(header => {
                if (header === "Tournée") return entry.tournee || "";
                if (header === "Nom") return entry.nom_compagnie || "";
                if (header === "Début tournée") return entry.debut_tournee || "";
                if (header === "Fin tournée") return entry.fin_tournee || "";
                if (header === "Classe véhicule") return entry.classe_vehicule || "";
                if (header === "Employé") return entry.id_employe || "";
                if (header === "Nom de l'employé") {
                    if (entry.nom_employe && entry.prenom_employe) return `${entry.nom_employe}, ${entry.prenom_employe}`;
                    return entry.nom_employe || "";
                }
                if (header === "Employé (Confirm)") return entry.id_employe_confirm || "";
                if (header === "Véhicule") return entry.vehicule || "";
                if (header === "Classe véhicule affecté") return entry.classe_vehicule_affecte || "";
                if (header === "Autoris") return entry.autoris || "";
                if (header === "Approuvé") return entry.approuve ? "Oui" : "Non";
                if (header === "Retour") return entry.retour ? "Oui" : "";
                if (header === "Adresse de début") return entry.adresse_debut || "";
                if (header === "Adresse de fin") return entry.adresse_fin || "";
                if (header === "Changement") return entry.changement || "";
                if (header === "Changement par") return entry.changement_par || "";

                return "";
            });
        });

        return { entries: rows, raw_text: initialRawText };

    } catch (error: any) {
        console.error("AI Error:", error);
        throw error;
    }
}
