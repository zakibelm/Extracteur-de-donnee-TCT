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
export const TCT_TABLE_HEADERS = [
    "Tournée",
    "Nom",
    "Début tournée",
    "Fin tournée",
    "Classe véhicule",
    "Employé",
    "Nom de l'employé",
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
            console.warn("Overriding prompt for Robust 15-col alignment V2.");
            systemInstruction = `Tu es un agent expert pour Taxi Coop Terrebonne.
Extrais les données et retourne un tableau texte avec séparateur PIPE (|).

## COLONNES (15 - STRUCTURE EXACTE)
Tournée | Nom | Déb tour | Fin tour | Cl véh | Employé | Nom de l'employé | Employé_Double | Véhicule | Cl véh aff | Autoris | Approuvé | Retour | Adresse de début | Adresse de fin

## RÈGLES DE MAPPING (CRUCIAL)
1. **Employé** (Col 6) : Chiffres (ID). S'il y a "TAXI", laisse VIDE.
2. **Employé_Double** (Col 8) : Ignore, mais garde la colonne.
3. **Approuvé** (Col 12) : Oui/Non.
4. **Adresses** : Copie complète.
5. **CHANGEMENT** : STOP. Ne rien extraire après Adresses.
6. UNE LIGNE PAR TOURNÉE.

Respecte scrupuleusement cet ordre de 15 colonnes.`;
        }
    }

    const basePrompt = isOlymel
        ? `MODE TABLEAU TEXTE (Séparateur Pipe |).`
        : `MODE TABLEAU TEXTE (Séparateur Pipe |).
           Analyse l'image. aligne les données EXACTEMENT sous ces entêtes:
           
           COLONNES (15):
           Tournée | Nom | Déb tour | Fin tour | Cl véh | Employé (ID) | Nom de l'employé | Employé (Double) | Véhicule (ID) | Cl véh aff | Autoris | Approuvé | Retour | Adresse de début | Adresse de fin
           
           RÈGLES ANTI-DÉCALAGE:
           1. Col 5 (Classe véh) = "TAXI" ou "MINIVAN".
           2. Col 6 (Employé) = CHIFFRES UNIQUEMENT.
           3. RECUPERE les 2 dernieres colonnes non vides comme ADRESSES.
           4. SORTIE BRUTE UNIQUEMENT.`;

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
                if (trimmedLine.length < 5 || trimmedLine.match(/^[-=|]+$/)) return;
                if (!trimmedLine.includes('|')) return;

                const parts = trimmedLine.split('|').map(p => p.trim());
                if (parts.length > 0 && parts[0] === '') parts.shift();
                if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();

                const entry: any = {};

                if (isOlymel) {
                    if (parts.length >= 3) {
                        let dateVal = parts[0];
                        if (dateVal.length < 3 && lastDate.length > 3) dateVal = lastDate;
                        else if (dateVal.length >= 3) lastDate = dateVal;
                        currentEntries.push(entry);
                    }
                } else {
                    // TCT MAPPING (15 COLUMNS scheme)
                    if (parts[0].toLowerCase().includes('tourn')) return;

                    entry.tournee = parts[0];
                    entry.nom_compagnie = parts[1];
                    entry.debut_tournee = parts[2];
                    entry.fin_tournee = parts[3];
                    entry.classe_vehicule = parts[4];
                    entry.id_employe = parts[5];

                    // --- ANTI-SHIFT AUTO-CORRECTION ---
                    const valCol5 = (parts[5] || "").toUpperCase();
                    const valCol6 = (parts[6] || "").trim();
                    let shiftIndex = 0;

                    if ((valCol5 === 'TAXI' || valCol5 === 'MINIVAN') && /^\d+$/.test(valCol6)) {
                        shiftIndex = 1; // Major Shift Detected
                        entry.id_employe = parts[6];
                    }

                    // Map fields based on shift
                    const rawNameIndex = 6 + shiftIndex;
                    const rawName = parts[rawNameIndex] || "";

                    if (rawName.includes(',')) {
                        const [nom, prenom] = rawName.split(',').map(s => s.trim());
                        entry.nom_employe = nom;
                        entry.prenom_employe = prenom;
                    } else if (rawName.includes(' ')) {
                        const nameParts = rawName.split(' ');
                        entry.nom_employe = nameParts[0];
                        entry.prenom_employe = nameParts.slice(1).join(' ');
                    } else {
                        entry.nom_employe = rawName;
                        entry.prenom_employe = "";
                    }

                    const vehiculeIndex = 8 + shiftIndex;
                    entry.vehicule = parts[vehiculeIndex];
                    entry.classe_vehicule_affecte = parts[vehiculeIndex + 1];

                    // Approuve logic
                    const approuveIndex = vehiculeIndex + 3; // +3 skips ClVehAff, Autoris
                    const rawAppr = (parts[approuveIndex] || "").toLowerCase();
                    entry.approuve = rawAppr.includes('oui') || rawAppr.includes('true') || rawAppr.includes('x') || rawAppr === 'o';

                    // SMART ADDRESS FETCHING (Grab from end of array)
                    const pLen = parts.length;
                    if (pLen >= 15) {
                        entry.adresse_fin = parts[pLen - 1] || ""; // Safe fallback
                        entry.adresse_debut = parts[pLen - 2] || "";
                    } else {
                        entry.adresse_debut = parts[13 + shiftIndex] || "";
                        entry.adresse_fin = parts[14 + shiftIndex] || "";
                    }

                    entry.stationnement = "";
                    entry.territoire_debut = "";

                    // FORCE EMPTY CHANGEMENT
                    entry.changement = "";
                    entry.changement_par = "";

                    if (Object.values(entry).filter(v => v !== "").length > 2) {
                        currentEntries.push(entry);
                    }
                }
            });
            console.log(`Parsed ${currentEntries.length} rows (Pipe Mode).`);
        }

        if (isJsonLike || currentEntries.length === 0) {
            try {
                const parsedData = cleanAndParseJson(initialRawText);
                if (Array.isArray(parsedData)) currentEntries = parsedData;
                else if (parsedData.entries) currentEntries = parsedData.entries;
                else if (parsedData.data) currentEntries = parsedData.data;
            } catch (e) { console.error("JSON Fallback failed", e); }
        }

        const observation = observeData(currentEntries);
        // ... err handling

        console.timeEnd('ObserveExecute_Total');

        if (!Array.isArray(currentEntries)) currentEntries = [];

        const rows: string[][] = currentEntries.map((entry: any) => {
            if (Array.isArray(entry)) {
                // ARRAY MODE: Strict mapping with Empty Changement Forced
                return headers.map((header, i) => {
                    if (header === "Changement" || header === "Changement par") return "";
                    return String(entry[i] || '');
                });
            }

            return headers.map(header => {
                // OBJECT MODE: Strict Empty Return
                if (header === "Changement") return "";
                if (header === "Changement par") return "";

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

                return "";
            });
        });

        return { entries: rows, raw_text: initialRawText };

    } catch (error: any) {
        console.error("AI Error:", error);
        throw error;
    }
}
