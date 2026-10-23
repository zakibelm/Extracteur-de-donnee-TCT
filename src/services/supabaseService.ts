import { DocumentMetadata } from '../types';
import { supabase, TctDocument, TctTournee, TctHistory } from '../lib/supabaseClient';

export interface SaveExtractionPayload {
    document: {
        filename: string;
        upload_date: string;
        status: 'success' | 'error';
        user_id: string;
        extracted_count: number;
    };
    tournees: Array<{
        tournee: string;
        nom: string;
        deb_tour: string;
        fin_tour: string;
        cl_veh: string;
        employe: string;
        nom_employe: string;
        vehicule: string;
        cl_veh_aff: string;
        stationnement: string;
        approuve: string;
        territoire_debut: string;
        adresse_debut: string;
        adresse_fin: string;
    }>;
    user_id: string;
    request_id: string;
    metadata?: DocumentMetadata;
}

export async function saveExtractionToSupabase(payload: SaveExtractionPayload) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Session expirée. Reconnectez-vous.');
    if (payload.user_id !== user.id || payload.document.user_id !== user.id) {
        throw new Error('Identité de sauvegarde invalide.');
    }
    const { data, error } = await supabase.rpc('save_tct_extraction', {
        p_request_id: payload.request_id,
        p_filename: payload.document.filename,
        p_upload_date: payload.document.upload_date,
        p_tournees: payload.tournees,
        p_metadata: payload.metadata || {},
    });
    if (error) throw new Error('Sauvegarde impossible. Vérifiez la configuration et réessayez.');
    return data as { success: boolean; documentId: number; tourneesCount: number; executionTime: number };
}

// Fonction pour récupérer les documents d'un utilisateur
export async function getUserDocuments(userId: string) {
    const { data, error } = await supabase
        .from('tct_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Erreur récupération documents:', error);
        throw error;
    }

    return data;
}

// Fonction pour récupérer les tournées d'un document
export async function getDocumentTournees(documentId: number) {
    const { data, error } = await supabase
        .from('tct_tournees')
        .select('*')
        .eq('document_id', documentId)
        .order('tournee', { ascending: true });

    if (error) {
        console.error('[Supabase] Erreur récupération tournées:', error);
        throw error;
    }

    return data;
}
