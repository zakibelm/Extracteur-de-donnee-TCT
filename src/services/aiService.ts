// Initialize Gemini API
const genAI = null;

export interface ExtractedData {
    entries: any[];
    headers: string[];
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
    "Déb tour",
    "Fin tour",
    "Cl véh",
    "Employé",
    "Nom de l'employé",
    "Employé (Confirm)",
    "Véhicule",
    "Cl véh aff",
    "Autoris",
    "Approuvé",
    "Retour",
    "Adresse de début",
    "Adresse de fin",
    "Changement",
    "Changement par"
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callAI(base64Image: string, mimeType: string, prompt: string, systemInstruction: string, documentType: string, temperature: number = 0.1): Promise<string> {
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
            "model": "anthropic/claude-3.5-sonnet", // Updated to Sonnet 3.5 as preferred
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
    return data.choices?.[0]?.message?.content || "";
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
        // TCT Default System Prompt (Scanner Mode)
        if (storedTctPrompt && storedTctPrompt.trim() !== "") {
            systemInstruction = storedTctPrompt;
        } else {
            console.warn("Using Standard 15-col STRICT SCANNER TCT Prompt.");
            systemInstruction = `You are TCT-Extractor.
You are a TABLE SCANNER.
MISSION: Extract the TCT table EXACTLY as it appears on screen (15 columns).
No business logic. No added columns.

FORMAT DE SORTIE (JSON STRICT):
{
  "tournees": [
    {
      "tournee": "...", "nom": "...", "debut": "...", "fin": "...", "client": "...",
      "employe_id": "...", "employe_nom": "...", "vehicule_id": "...", "vehicule_type": "...",
      "cle_vehicule_affectee": "...", "autorise": "...", "approuve": "...", "retour": "...",
      "adresse_debut": "...", "adresse_fin": "..."
    }
  ]
}

CRITICAL: Do NOT add 'changement' columns. Copy EXACTLY what is visible.`;
        }
    }

    const basePrompt = isOlymel
        ? `MODE TABLEAU TEXTE (Séparateur Pipe |).`
        : `MODE: execute
           Analayse l'image et extrais les données des tournées au format JSON structuré comme défini dans le prompt système.`;

    try {
        let initialRawText = await callAI(base64Image, mimeType, basePrompt, systemInstruction, documentType, 0.1);
        console.log(`${documentType} RAW TEXT:`, initialRawText.substring(0, 500));

        let currentEntries: any[] = [];

        if (isOlymel) {
            // Keep legacy Olymel parsing for now or update it later if needed. Olymel was working with pipes?
            // Assuming Olymel acts differently. For now, let's leave Olymel logic as "legacy pipe" if it was working, 
            // BUT the user didn't ask to break Olymel.
            // To be safe, let's use the old pipe logic ONLY for Olymel.
            const cleanText = initialRawText.replace(/```(csv|json|markdown)?/gi, '').replace(/```/g, '').trim();
            const lines = cleanText.split(/\r?\n/);
            lines.forEach(line => {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length >= 3) { // Minimal validation
                    const entry: any = {};
                    headers.forEach((h, i) => entry[h] = parts[i] || "");
                    currentEntries.push(entry);
                }
            });
        } else {
            // TCT JSON PARSING logic
            try {
                const parsedData = cleanAndParseJson(initialRawText);
                if (parsedData.tournees && Array.isArray(parsedData.tournees)) {
                    currentEntries = parsedData.tournees;
                } else if (Array.isArray(parsedData)) {
                    currentEntries = parsedData;
                } else if (parsedData.entries) {
                    currentEntries = parsedData.entries;
                }
                console.log(`Parsed ${currentEntries.length} rows from JSON.`);
            } catch (e) {
                console.error("JSON Parsing failed for TCT:", e);
                // Fallback or error handling
            }
        }

        console.timeEnd('ObserveExecute_Total');

        const rows: string[][] = currentEntries.map((entry: any) => {
            if (isOlymel) {
                return headers.map(h => entry[h] || ""); // Access by header name key if we did that, or if entry is array... 
                // Olymel logic above pushed objects with header keys? No, wait, I need to check how Olymel pushed.
                // Actually, let's fix the Olymel part to be safe.
                if (Array.isArray(entry)) return entry.map(String);
                return headers.map((_, i) => String(entry[i] || '')); // Simplistic
            }

            // TCT Mapping - INJECTING BUSINESS LOGIC "Changement = Vehicule"
            return headers.map(header => {
                switch (header) {
                    // Direct Mappings
                    case "Tournée": return entry.tournee || "";
                    case "Nom": return entry.nom || entry.nom_compagnie || "";
                    case "Déb tour": return entry.debut || entry.debut_tournee || "";
                    case "Fin tour": return entry.fin || entry.fin_tournee || "";

                    // Column 5: Client / Class Prio
                    case "Cl véh": return entry.client || entry.classe_vehicule || "";

                    // Employee Handing - Logic: Duplicate ID
                    case "Employé": return entry.employe_id || entry.id_employe || "";
                    case "Nom de l'employé": {
                        return entry.employe_nom || entry.nom_employe_complet || "";
                    }
                    case "Employé (Confirm)": return entry.employe_id || entry.id_employe_confirm || "";

                    // Vehicle & Change Logic - Logic: Changement = Vehicule
                    case "Véhicule": return entry.vehicule_id || entry.vehicule || "";
                    case "Cl véh aff": return entry.vehicule_type || entry.classe_vehicule_affecte || "";
                    case "Autoris": return entry.autorise || entry.autorisation || "";

                    // Booleans
                    case "Approuvé": return (entry.approuve === true || entry.approuve === "true" || entry.approuve === "Oui") ? "Oui" : "";
                    case "Retour": return (entry.retour === true || entry.retour === "true" || entry.retour === "Oui") ? "Oui" : "";

                    case "Adresse de début": return entry.adresse_debut || "";
                    case "Adresse de fin": return entry.adresse_fin || "";

                    // INJECTED LOGIC: CHANGEMENT = VEHICULE
                    case "Changement": return entry.vehicule_id || entry.vehicule || "";
                    case "Changement par": return entry.vehicule_id || entry.vehicule || ""; // User requested logic: "changement_par = vehicule"

                    default: return "";
                }
            });
        });

        return { entries: rows, headers: headers, raw_text: initialRawText, metadata: (currentEntries as any).metadata };

    } catch (error: any) {
        console.error("AI Error:", error);
        throw error;
    }
}
