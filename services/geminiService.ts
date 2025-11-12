import { GoogleGenAI, Type } from "@google/genai";
import { ParsedContent, TableData, ChatMessage } from '../types';

// This is a hard requirement. The API key must be obtained from this environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TABLE_HEADERS = [
    "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
    "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
    "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin"
];

const singleTableSchema = {
    type: Type.OBJECT,
    properties: {
        "Tournée": { type: Type.STRING }, "Nom": { type: Type.STRING },
        "Début tournée": { type: Type.STRING }, "Fin tournée": { type: Type.STRING },
        "Classe véhicule": { type: Type.STRING }, "Employé": { type: Type.STRING },
        "Nom de l'employé": { type: Type.STRING }, "Véhicule": { type: Type.STRING },
        "Classe véhicule affecté": { type: Type.STRING }, "Stationnement": { type: Type.STRING },
        "Approuvé": { type: Type.STRING }, "Territoire début": { type: Type.STRING },
        "Adresse de début": { type: Type.STRING }, "Adresse de fin": { type: Type.STRING },
    },
    required: TABLE_HEADERS,
};

const batchResponseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: "L'identifiant unique du fichier traité." },
            entries: {
                type: Type.ARRAY,
                description: "Liste des affectations de tournées extraites de ce fichier.",
                items: singleTableSchema,
            },
        },
        required: ["id", "entries"],
    },
};


/**
 * Extracts tabular data from a batch of OCR texts using the Gemini API.
 * @param ocrResults An array of objects, each containing a file id and its OCR text.
 * @returns A promise that resolves to an array of parsed content results.
 */
export async function extractDataWithGeminiBatch(
    ocrResults: { id: string, ocrText: string }[]
): Promise<{ id: string, content: ParsedContent }[]> {
    
    const textChunks = ocrResults.map(result => `
--- DEBUT DOCUMENT (ID: ${result.id}) ---
${result.ocrText}
--- FIN DOCUMENT (ID: ${result.id}) ---
`).join('\n');

    const prompt = `À partir du lot de textes suivants, extrais les données de chaque document. Chaque document est identifié par un ID.
Pour chaque document, extrais toutes les lignes de données du tableau "Affectations des tournées" et retourne-les dans un objet JSON qui correspond à son ID.

Textes à analyser:
${textChunks}

Instructions:
- Le format de sortie doit être un tableau JSON.
- Chaque élément du tableau doit être un objet contenant "id" et "entries".
- L'"id" doit correspondre à l'ID du document que tu traites.
- "entries" doit être un tableau d'objets, où chaque objet représente une ligne du tableau.
- Les colonnes sont : ${TABLE_HEADERS.join(', ')}.
- Si une valeur est manquante, utilise une chaîne vide "".
- Ne renvoie que du JSON valide qui correspond au schéma. Si un document ne contient aucune donnée de tableau, retourne un tableau "entries" vide pour cet ID.
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: batchResponseSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson: { id: string, entries: Record<string, string>[] }[] = JSON.parse(jsonText);
        
        const results = parsedJson.map(fileResult => {
            const rows: string[][] = fileResult.entries.map((entry) => 
                TABLE_HEADERS.map(header => entry[header] || '')
            );
            return {
                id: fileResult.id,
                content: { headers: TABLE_HEADERS, rows }
            };
        });

        // Ensure all original IDs have a result, even if empty
        return ocrResults.map(original => {
            const found = results.find(r => r.id === original.id);
            if (found) return found;
            return { id: original.id, content: { headers: TABLE_HEADERS, rows: [] } };
        });

    } catch (error) {
        console.error("Erreur lors de l'appel batch à l'API Gemini:", error);
        let errorMessage = "Une erreur est survenue lors de l'analyse par l'IA.";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        // Return error message for all files in the batch
        return ocrResults.map(r => ({
            id: r.id,
            content: { headers: ["Erreur"], rows: [[errorMessage]] }
        }));
    }
}


/**
 * Asks a question to the Gemini API about a given dataset.
 * @param contextData The unified table data to use as context.
 * @param history The previous chat messages for context.
 * @param userQuestion The new question from the user.
 * @returns A promise that resolves to the model's text response.
 */
export async function askGeminiAboutData(
    contextData: TableData,
    history: ChatMessage[],
    userQuestion: string
): Promise<string> {
    const dataAsJSON = JSON.stringify({
        headers: contextData.headers,
        rows: contextData.rows
    }, null, 2);

    const historyForPrompt = history.map(msg => `${msg.role}: ${msg.text}`).join('\n');

    const prompt = `Tu es un assistant expert en analyse de données. On te fournit un ensemble de données sous forme de JSON et un historique de conversation. Réponds à la nouvelle question de l'utilisateur en te basant **uniquement** sur les données fournies. Sois concis et précis. Si la réponse ne se trouve pas dans les données, dis-le clairement.

--- DEBUT DES DONNÉES ---
${dataAsJSON}
--- FIN DES DONNÉES ---

--- HISTORIQUE DE LA CONVERSATION ---
${historyForPrompt}
--- FIN DE L'HISTORIQUE ---

Nouvelle question de l'utilisateur: "${userQuestion}"

Ta réponse:
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Gemini (Chat):", error);
        throw new Error("Impossible d'obtenir une réponse de l'assistant IA.");
    }
}
