
import { GoogleGenAI, Type } from "@google/genai";
import { ParsedContent, TableData } from '../types';

// This is a hard requirement. The API key must be obtained from this environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TABLE_HEADERS = [
    "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
    "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
    "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin"
];

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        entries: {
            type: Type.ARRAY,
            description: "Liste des affectations de tournées extraites de l'image.",
            items: {
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
                required: TABLE_HEADERS
            }
        }
    },
    required: ["entries"],
};

/**
 * Extracts tabular data from a single image using the Gemini Vision API.
 * @param base64Image The base64 encoded image string.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to the parsed table content.
 */
export async function extractDataFromImage(base64Image: string, mimeType: string): Promise<ParsedContent> {
    const prompt = `À partir de l'image fournie, localise le tableau "Affectations des tournées".
Extrais toutes les lignes de données de ce tableau.

Instructions:
- Analyse attentivement l'image pour identifier la structure du tableau, même si les lignes ou les colonnes sont mal alignées.
- Le format de sortie doit être un objet JSON unique contenant une clé "entries".
- "entries" doit être un tableau d'objets, où chaque objet représente une ligne du tableau.
- Les colonnes à extraire sont : ${TABLE_HEADERS.join(', ')}.
- Si une valeur est manquante ou illisible dans une cellule, utilise une chaîne vide "".
- Fais preuve d'intelligence pour corriger les erreurs de reconnaissance de caractères évidentes (ex: "l" pour "1", "O" pour "0").
- Ne renvoie que du JSON valide qui correspond au schéma demandé. Si le tableau n'est pas trouvé ou est vide, retourne un tableau "entries" vide.
`;

    try {
        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType,
            },
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }, imagePart] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });

        const jsonText = response.text.trim();
        if (!jsonText) {
            throw new Error("L'IA n'a retourné aucune donnée. Le contenu a peut-être été bloqué pour des raisons de sécurité.");
        }

        const parsedJson: { entries: Record<string, string>[] } = JSON.parse(jsonText);
        
        if (!parsedJson || !Array.isArray(parsedJson.entries)) {
            throw new Error("La réponse de l'IA est mal structurée (tableau 'entries' manquant).");
        }
        
        const rows: string[][] = parsedJson.entries.map((entry) => 
            TABLE_HEADERS.map(header => entry[header] || '')
        );

        return { headers: TABLE_HEADERS, rows };

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Gemini Vision:", error);
        let errorMessage = "Une erreur inattendue est survenue lors de l'analyse par l'IA.";
        if (error instanceof Error) {
            if (error instanceof SyntaxError) {
                 errorMessage = "L'IA a retourné une réponse invalide (JSON mal formé). Veuillez réessayer.";
            } else {
                errorMessage = error.message;
            }
        }
        return { headers: ["Erreur"], rows: [[errorMessage]] };
    }
}