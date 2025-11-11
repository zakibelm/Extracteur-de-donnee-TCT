import { GoogleGenAI, Part, Type } from '@google/genai';
import { ParsedContent, TableData } from '../types';

const TARGET_HEADERS = [
  "ID / Réf.", "Compagnie", "Heure départ", "Heure arrivée", "Type véhicule", 
  "Code chauffeur", "Nom chauffeur", "Numéro véhicule", "Modèle", 
  "Adresse départ", "Adresse arrivée", "Statut"
];

const createPrompt = (ocrText: string): string => {
  return `Vous êtes un assistant expert en extraction et nettoyage de données tabulaires à partir de documents.
Votre mission est d'analyser l'image et le texte OCR fourni pour extraire, nettoyer, et structurer les données dans un tableau unique en respectant rigoureusement le schéma JSON de sortie.

Instructions clés :
1.  **Unification des En-têtes :** Vous devez mapper les en-têtes détectés dans l'image vers les en-têtes cibles définis dans le schéma. Par exemple, "Réf.", "Ref", "ID" doivent tous être mappés à "ID / Réf.". "Heure départ", "Déb tour", "Time_1" doivent devenir "Heure départ".
2.  **Reconstruction des Données :** Reconstituez les informations qui sont visiblement coupées sur plusieurs lignes (ex: adresses longues) en une seule chaîne de caractères dans la cellule appropriée.
3.  **Nettoyage :** Supprimez les caractères parasites, les tabulations excessives ou les retours à la ligne erronés. Corrigez les erreurs de lecture de l'OCR en vous basant sur le contexte et la structure visible dans l'image.
4.  **Complétion :** Si une colonne du schéma cible n'est pas présente dans l'image, laissez la valeur correspondante comme une chaîne de caractères vide ("") pour chaque ligne. Ne supprimez pas la colonne.
5.  **Texte OCR de Référence :** Utilisez le texte OCR ci-dessous comme une aide, mais fiez-vous principalement à l'image pour la structure et la correction des erreurs.
--- DEBUT DU TEXTE OCR ---
${ocrText || "L'OCR n'a renvoyé aucun texte."}
--- FIN DU TEXTE OCR ---

Répondez EXCLUSIVEMENT avec un objet JSON. Ne renvoyez que l'objet JSON, sans formatage de démarque, texte explicatif ou notes.

Le JSON doit avoir une seule propriété "table".
La valeur de "table" doit être un objet contenant deux propriétés : "headers" et "rows".
- La propriété "headers" DOIT être un tableau contenant EXACTEMENT les chaînes de caractères suivantes, dans cet ordre : ${JSON.stringify(TARGET_HEADERS)}.
- La propriété "rows" doit être un tableau de tableaux, où chaque sous-tableau représente une ligne et contient les valeurs correspondant aux en-têtes.`;
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    table: {
      type: Type.OBJECT,
      properties: {
        headers: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING } 
        },
        rows: { 
          type: Type.ARRAY, 
          items: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          } 
        }
      }
    }
  }
};

export async function extractTextFromImage(ai: GoogleGenAI, imagePart: Part, ocrText: string): Promise<ParsedContent> {
  try {
    const prompt = createPrompt(ocrText);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
      // NOTE: Removing the config with responseSchema to avoid potential proxy/network issues ("xhr error").
      // The prompt is engineered to request a JSON-only response, but we add robust parsing as a fallback.
    });
    
    let jsonString = response.text;
    
    // The model might still wrap the JSON in ```json ... ```, or include other text.
    // We'll try to extract the JSON object robustly.
    const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1];
    } else {
        // If no markdown block, find the first '{' and last '}'
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }
    }
    
    try {
        const parsedJson = JSON.parse(jsonString.trim());

        if (parsedJson.table && parsedJson.table.headers && parsedJson.table.rows) {
          const tableData: TableData = parsedJson.table;
          return tableData;
        } else {
          console.warn("La réponse de l'API n'a pas le format de tableau attendu, retour d'un tableau vide.", parsedJson);
          return { headers: TARGET_HEADERS, rows: [] };
        }
    } catch (parseError) {
        console.error("Échec de l'analyse JSON. Réponse brute de l'API:", response.text);
        const errorMessage = parseError instanceof Error ? parseError.message : 'Format invalide';
        // This specific error message will be displayed in the UI for the user.
        throw new Error(`L'IA a retourné un format de données non valide: ${errorMessage}.`);
    }

  } catch (error) {
    console.error("Erreur lors de l'appel à l'API Gemini:", error);
    
    const errorAsAny = error as any;
    
    // Pass our custom parsing error through.
    if (error instanceof Error && error.message.startsWith("L'IA a retourné un format de données non valide")) {
        throw error;
    }

    if (errorAsAny?.error?.message) {
        throw new Error(`API Gemini: ${errorAsAny.error.message}`);
    }
    
    if (error instanceof Error) {
        throw new Error(`Erreur inattendue: ${error.message}`);
    }

    throw new Error("La requête à l'API Gemini a échoué.");
  }
}