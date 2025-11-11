import { ParsedContent } from '../types';

// Utilise la variable d'environnement VITE_API_URL fournie par Docker/Vite,
// avec une valeur par défaut pour le développement local.
// FIX: Cast to unknown first to resolve TypeScript error with import.meta.env
const API_BASE_URL = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:8000/api';


/**
 * Submits an extraction task to the backend.
 * The backend will process the file asynchronously.
 * 
 * @param file The image or PDF file page to be processed.
 * @param ocrText The text extracted from the file by the client-side OCR.
 * @returns A promise that resolves to an object containing the task_id.
 */
export async function startExtractionTask(file: File, ocrText: string): Promise<{ task_id: string }> {
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
      const errorData = await response.json().catch(() => ({ detail: 'Erreur inconnue du serveur.' }));
      throw new Error(`Erreur de l'API (${response.status}): ${errorData.detail || 'Réponse invalide du serveur'}`);
    }

    const result = await response.json();
    if (result.task_id) {
        return result;
    } else {
        throw new Error("La réponse du serveur ne contient pas de task_id.");
    }
  } catch (error) {
    console.error("Erreur lors du démarrage de la tâche d'extraction:", error);
    if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error("La communication avec le serveur a échoué. Assurez-vous que le backend est en cours d'exécution.");
        }
        throw error;
    }
    throw new Error("Une erreur inattendue est survenue lors du démarrage de la tâche.");
  }
}

export interface TaskStatusResponse {
    status: 'en attente' | 'terminé' | 'échec' | string; // other celery states
    result?: ParsedContent;
    error?: string;
}

/**
 * Fetches the status of a specific extraction task.
 * 
 * @param taskId The ID of the task to check.
 * @returns A promise that resolves to the task status object.
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    const backendUrl = `${API_BASE_URL}/status/${taskId}`;
    try {
        const response = await fetch(backendUrl);

        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ detail: 'Erreur inconnue du serveur.' }));
             throw new Error(`Erreur de l'API (${response.status}): ${errorData.detail || 'Réponse invalide du serveur'}`);
        }
        return await response.json();
    } catch(error) {
        console.error(`Erreur lors de la récupération du statut de la tâche ${taskId}:`, error);
        if (error instanceof Error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error("La communication avec le serveur a échoué.");
            }
            throw error;
        }
        throw new Error("Une erreur inattendue est survenue lors de la récupération du statut.");
    }
}