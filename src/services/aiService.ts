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

// TCT Columns (15 Columns - Strict Extraction)
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
    "Adresse de fin"
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
        // TCT Default System Prompt (CSV Scanner Mode)
        if (storedTctPrompt && storedTctPrompt.trim() !== "") {
            systemInstruction = storedTctPrompt;
        } else {
            console.warn("Using Standard CSV SCANNER TCT Prompt.");
            systemInstruction = `SYSTEM PROMPT — TCT Extractor (RAW Scanner Mode)
You are a TABLE SCANNER.
MISSION: Extract TCT table EXACTLY as visible. NO business logic.

MANDATORY METHOD:
1) Read headers EXACTLY.
2) Read rows cell by cell.
3) Output CSV with semicolon ; separator.

OUTPUT FORMAT:
CSV with semicolon ; separator
First row = EXACT headers

CRITICAL RULES:
- If unsure -> leave empty
- NEVER shift data
- 15 columns expected (approx)
- NO Added columns
- NO Markdown blocks (just raw text)
`;
        }
    }

    // UPDATED BASE PROMPT FOR CSV
    const basePrompt = isOlymel
        ? `MODE TABLEAU TEXTE (Séparateur Pipe |).`
        : `Expected Output: CSV with semicolon separator. STRICT RAW SCAN.`;

    try {
        let initialRawText = await callAI(base64Image, mimeType, basePrompt, systemInstruction, documentType, 0.1);
        console.log(`${documentType} RAW TEXT:`, initialRawText.substring(0, 500));

        let currentEntries: any[] = [];

        // RAW CSV PARSING
        const cleanText = initialRawText.replace(/```(csv|ma?rkdown)?/gi, '').replace(/```/g, '').trim();
        const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length > 1) {
            const separator = isOlymel ? '|' : ';';

            // Extract Headers from First Line
            const detectedHeaders = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
            console.log("Detected Headers:", detectedHeaders);

            // Parse Rows
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const parts = line.split(separator).map(p => p.trim().replace(/^"|"$/g, ''));

                // Basic validation
                if (parts.length >= Math.max(2, detectedHeaders.length - 2)) {
                    const entry: any = {};
                    detectedHeaders.forEach((h, index) => {
                        entry[h] = parts[index] || "";
                        entry[`_col_${index}`] = parts[index] || "";
                    });
                    currentEntries.push(entry);
                }
            }
        } else {
            // Fallback JSON parsing
            try {
                const parsedData = cleanAndParseJson(initialRawText);
                if (parsedData.tournees) currentEntries = parsedData.tournees;
                else if (parsedData.entries) currentEntries = parsedData.entries;
            } catch (e) {
                console.warn("Failed to parse as CSV or JSON");
            }
        }

        console.log(`Parsed ${currentEntries.length} rows.`);
        console.timeEnd('ObserveExecute_Total');

        const rows: string[][] = currentEntries.map((entry: any) => {
            if (isOlymel) {
                if (Array.isArray(entry)) return entry.map(String);
                return OLYMEL_TABLE_HEADERS.map((_, i) => entry[`_col_${i}`] || "");
            }

            // TCT MAPPING (15 COLUMNS - NO INJECTION)
            return TCT_TABLE_HEADERS.map(targetHeader => {
                const val = (idx: number) => entry[`_col_${idx}`] || "";

                switch (targetHeader) {
                    case "Tournée": return val(0);
                    case "Nom": return val(1);
                    case "Déb tour": return val(2);
                    case "Fin tour": return val(3);
                    case "Cl véh": return val(4);

                    case "Employé": return val(5);
                    case "Nom de l'employé": return val(6);
                    case "Employé (Confirm)": return val(7);

                    case "Véhicule": return val(8);
                    case "Cl véh aff": return val(9);

                    case "Autoris": return val(10);
                    case "Approuvé": return (val(11).toLowerCase().includes('true') || val(11).includes('✓') || val(11) === "Oui") ? "Oui" : "";
                    case "Retour": return (val(12).toLowerCase().includes('true') || val(12).includes('✓') || val(12) === "Oui") ? "Oui" : "";

                    case "Adresse de début": return val(13);
                    case "Adresse de fin": return val(14);

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
