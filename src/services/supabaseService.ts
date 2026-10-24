import { TCT_FIELDS, TCT_HEADERS, validateTable } from '../utils/table';
import { DocumentMetadata, TableData } from '../types';
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
    if (!data?.success || !Number.isSafeInteger(data.documentId) || data.documentId <= 0 || data.tourneesCount !== payload.tournees.length) {
        throw new Error('La base n’a pas confirmé l’enregistrement complet. Réessayez.');
    }
    return data as { success: boolean; documentId: number; tourneesCount: number; executionTime: number };
}

// Fonction pour récupérer les documents d'un utilisateur
export async function getUserDocuments(userId: string) {
    const { data, error } = await supabase
        .from('tct_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('[Supabase] Erreur récupération documents:', error);
        throw error;
    }

    return data;
}

// Fonction pour récupérer les tournées d'un document
export async function getDocumentTournees(documentId: number) {
    const rows: TctTournee[] = [];
    const pageSize = 1000;
    for (let start = 0; ; start += pageSize) {
        const { data, error } = await supabase.from('tct_tournees').select('*')
            .eq('document_id', documentId).order('id', { ascending: true }).range(start, start + pageSize - 1);
        if (error) throw new Error('Impossible de recharger les tournées. Réessayez.');
        rows.push(...(data || []));
        if (!data || data.length < pageSize) return rows;
    }
}

export async function getSavedExtraction(userId: string, documentId: number): Promise<{ table: TableData; filename: string }> {
    const { data: document, error } = await supabase.from('tct_documents').select('*')
        .eq('id', documentId).eq('user_id', userId).single();
    if (error || !document) throw new Error('Document inaccessible pour ce compte.');
    const tournees = await getDocumentTournees(documentId);
    if (!tournees.length || tournees.length !== document.extracted_count) throw new Error('Les lignes enregistrées sont incomplètes. Réessayez le chargement.');
    const table = validateTable({ headers: [...TCT_HEADERS],
        rows: tournees.map(row => TCT_FIELDS.map(field => String(row[field] ?? ''))),
        metadata: document.source_metadata || (document.schedule_date ? { schedule_date: document.schedule_date } : {}),
    }, TCT_HEADERS);
    return { table, filename: document.filename };
}
