/**
 * Service pour interagir avec n8n
 * Sauvegarde les données d'extraction dans les Data Tables n8n via webhook
 */

export interface N8NDocumentPayload {
    filename: string;
    file_url?: string;
    upload_date: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    user_id: string;
    extracted_count: number;
}

export interface N8NTourneePayload {
    document_id?: string;
    tournee: string;
    nom: string;
    deb_tour: string;
    fin_tour: string;
    cl_veh: string;
    employe: string;
    nom_employe: string;
    employe_confirm: string;
    vehicule: string;
    cl_veh_aff: string;
    autoris: string;
    approuve: string;
    retour: string;
    adresse_debut: string;
    adresse_fin: string;
}

export interface N8NHistoryPayload {
    document_id?: string;
    action: string;
    status: 'success' | 'error';
    message: string;
    execution_time_ms?: number;
}

const N8N_BASE_URL = 'https://n8n.srv679767.hstgr.cloud';

/**
 * Sauvegarde un document et ses tourn
ées dans n8n
 */
export async function saveExtractionToN8N(
    documentData: N8NDocumentPayload,
    tourneesData: N8NTourneePayload[],
    userId: string
): Promise<{ success: boolean; documentId?: string; error?: string }> {

    const startTime = Date.now();

    try {
        // Construire le payload complet
        const payload = {
            document: documentData,
            tournees: tourneesData,
            user_id: userId,
            timestamp: new Date().toISOString()
        };

        console.log('[N8N] Envoi des données d\'extraction:', {
            filename: documentData.filename,
            tournees_count: tourneesData.length,
            user_id: userId
        });

        // URL du webhook n8n pour l'upload de documents TCT
        const webhookUrl = `${N8N_BASE_URL}/webhook/tct-upload-document`;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`N8N Webhook Error (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        const executionTime = Date.now() - startTime;

        console.log('[N8N] Données sauvegardées avec succès:', {
            documentId: result.document_id,
            execution_time_ms: executionTime
        });

        // Logger l'historique
        await logToN8NHistory({
            document_id: result.document_id,
            action: 'extraction_saved',
            status: 'success',
            message: `Extraction réussie: ${tourneesData.length} tournées`,
            execution_time_ms: executionTime
        });

        return {
            success: true,
            documentId: result.document_id
        };

    } catch (error: any) {
        const executionTime = Date.now() - startTime;

        console.error('[N8N] Erreur lors de la sauvegarde:', error);

        // Logger l'erreur dans l'historique
        await logToN8NHistory({
            action: 'extraction_failed',
            status: 'error',
            message: error.message || 'Erreur inconnue',
            execution_time_ms: executionTime
        });

        return {
            success: false,
            error: error.message || 'Erreur inconnue lors de la sauvegarde'
        };
    }
}

/**
 * Logger un événement dans l'historique n8n
 */
export async function logToN8NHistory(historyData: N8NHistoryPayload): Promise<void> {
    try {
        const webhookUrl = `${N8N_BASE_URL}/webhook/tct-history`;

        await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...historyData,
                created_at: new Date().toISOString()
            })
        });
    } catch (error) {
        // Silently fail for history logging
        console.warn('[N8N] Failed to log history:', error);
    }
}

/**
 * Récupérer les documents d'un utilisateur depuis n8n
 */
export async function getUserDocumentsFromN8N(userId: string): Promise<any[]> {
    try {
        const webhookUrl = `${N8N_BASE_URL}/webhook/tct-get-user-documents?userId=${encodeURIComponent(userId)}`;

        const response = await fetch(webhookUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`N8N Error (${response.status})`);
        }

        const result = await response.json();
        return result.documents || [];
    } catch (error) {
        console.error('[N8N] Erreur lors de la récupération des documents:', error);
        return [];
    }
}

/**
 * Récupérer les tournées d'un document depuis n8n
 */
export async function getDocumentTourneesFromN8N(documentId: string): Promise<any[]> {
    try {
        const webhookUrl = `${N8N_BASE_URL}/webhook/tct-get-tournees?documentId=${encodeURIComponent(documentId)}`;

        const response = await fetch(webhookUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`N8N Error (${response.status})`);
        }

        const result = await response.json();
        return result.tournees || [];
    } catch (error) {
        console.error('[N8N] Erreur lors de la récupération des tournées:', error);
        return [];
    }
}
