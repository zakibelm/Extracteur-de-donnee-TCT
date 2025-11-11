import { ParsedContent } from '../types';

// Utilise la variable d'environnement VITE_API_URL fournie par Docker/Vite,
// avec une valeur par défaut pour le développement local.
// FIX: Cast `import.meta` to inform TypeScript about the `env` property provided by Vite.
// The previous attempt to define `ImportMeta` with an interface was incorrect within a module's scope.
const API_BASE_URL = (import.meta as { env: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:8000/api';


/**
 * Sends the file and OCR text to the backend proxy for data extraction.
 * The backend handles the secure call to the Gemini API.
 * 
 * @param file The image or PDF file to be processed.
 * @param ocrText The text extracted from the file by the client-side OCR.
 * @returns A promise that resolves to the parsed tabular data.
 */
export async function extractTextFromImage(file: File, ocrText: string): Promise<ParsedContent> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("ocr_text", ocrText);

  const backendUrl = `${API_BASE_URL}/extract`;

  try {
    const response = await fetch(backendUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      // Try to parse the error response from the backend for a more detailed message.
      const errorData = await response.json().catch(() => ({ detail: 'Erreur inconnue du serveur.' }));
      throw new Error(`Erreur de l'API (${response.status}): ${errorData.detail || 'Réponse invalide du serveur'}`);
    }

    const result = await response.json();

    if (result.status === 'success' && result.data) {
      // The backend response wraps the table data in a "data" property.
      return result.data;
    } else {
      // Handle cases where the response is successful but doesn't contain the expected data structure.
      throw new Error(result.message || "La réponse de l'API n'a pas le format attendu.");
    }
  } catch (error) {
    console.error("Erreur lors de l'appel au backend proxy:", error);
    
    // Re-throw the error so it can be caught by the UI component and displayed to the user.
    if (error instanceof Error) {
        // Add a more user-friendly message for network errors.
        if (error.message.includes('Failed to fetch')) {
            throw new Error("La communication avec le serveur a échoué. Assurez-vous que le backend est en cours d'exécution.");
        }
        throw error;
    }
    
    throw new Error("Une erreur inattendue est survenue.");
  }
}
