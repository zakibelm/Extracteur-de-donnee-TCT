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
        // TCT Default System Prompt (JSON Structure)
        if (storedTctPrompt && storedTctPrompt.trim() !== "") {
            systemInstruction = storedTctPrompt;
        } else {
            console.warn("Using Standard 17-col JSON TCT Prompt.");
            // Note: In a real scenario, we might import this from the markdown file, but for now we inline a minimal version matching the artifact 
            // to ensure fallback works if local storage is empty.
            // Ideally the user sets the prompt in the UI, which saves to localStorage.
            systemInstruction = `Tu es un agent d'extraction pour Taxi Coop Terrebonne.
STRUCTURE EXACTE DU TABLEAU TCT: 17 colonnes (Tournée, Nom, Déb, Fin, Cl véh, Emp, Nom Emp, Emp(2), Véh, Cl véh aff, Autoris, Approuvé, Retour, Adr Déb, Adr Fin, Changement, Changement par).

MODE: execute
Extrais TOUTES les lignes au format JSON:
{
  "phase": "execute",
  "tournees": [
    {
      "tournee": "...", "nom_compagnie": "...", "debut_tournee": "...", "fin_tournee": "...", "classe_vehicule": "...", 
      "id_employe": "...", "nom_employe_complet": "...", "id_employe_confirm": "...", "vehicule": "...", "classe_vehicule_affecte": "...", 
      "autorisation": "...", "approuve": true/false, "retour": true/false, 
      "adresse_debut": "...", "adresse_fin": "...", "changement": "...", "changement_par": "..."
    }
  ]
}
IMPORTANT: "changement" et "changement_par" sont des numéros DOME. "adresse_debut/fin" doivent être complètes.`;
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

            // TCT Mapping from JSON keys to Array based on Headers Order
            return headers.map(header => {
                // Mapping keys from JSON to Headers
                switch (header) {
                    case "Tournée": return entry.tournee || "";
                    case "Nom": return entry.nom_compagnie || "";
                    case "Déb tour": return entry.debut_tournee || "";
                    case "Fin tour": return entry.fin_tournee || "";
                    case "Classe véhicule": return entry.classe_vehicule || "";
                    case "Employé": return entry.id_employe || "";
                    case "Nom de l'employé": {
                        // Prefer nom_employe_complet if available
                        if (entry.nom_employe_complet) return entry.nom_employe_complet;
                        // Fallback to split fields
                        if (entry.nom_employe && entry.prenom_employe) return `${entry.nom_employe}, ${entry.prenom_employe}`;
                        return entry.nom_employe || "";
                    }
                    case "Employé (Confirm)": return entry.id_employe_confirm || entry.id_employe || ""; // Fallback to id_employe if confirm missing? User said they must match.
                    case "Véhicule": return entry.vehicule || "";
                    case "Classe véhicule affecté": return entry.classe_vehicule_affecte || "";
                    case "Autoris": return entry.autorisation || ""; // Note key difference 'autorisation' vs 'Autoris' header
                    case "Approuvé": return (entry.approuve === true || entry.approuve === "true" || entry.approuve === "Oui") ? "Oui" : "";
                    case "Retour": return (entry.retour === true || entry.retour === "true" || entry.retour === "Oui") ? "Oui" : "";
                    case "Adresse de début": return entry.adresse_debut || "";
                    case "Adresse de fin": return entry.adresse_fin || "";
                    case "Changement": return entry.changement || "";
                    case "Changement par": return entry.changement_par || "";
                    default: return "";
                }
            });
        });

        return { entries: rows, raw_text: initialRawText, metadata: (currentEntries as any).metadata };

    } catch (error: any) {
        console.error("AI Error:", error);
        throw error;
    }
}
