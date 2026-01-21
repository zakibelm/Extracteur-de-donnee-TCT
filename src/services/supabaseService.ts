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
        employe_confirm: string;
        vehicule: string;
        cl_veh_aff: string;
        autoris: string;
        approuve: string;
        retour: string;
        adresse_debut: string;
        adresse_fin: string;
    }>;
    user_id: string;
}

export async function saveExtractionToSupabase(payload: SaveExtractionPayload) {
    const startTime = Date.now();

    try {
        console.log('[Supabase] Sauvegarde extraction...', {
            filename: payload.document.filename,
            tournees_count: payload.tournees.length,
            user_id: payload.user_id
        });

        // 1. Insérer le document
        const { data: documentData, error: documentError } = await supabase
            .from('tct_documents')
            .insert({
                filename: payload.document.filename,
                upload_date: payload.document.upload_date,
                status: payload.document.status,
                user_id: payload.user_id,
                extracted_count: payload.document.extracted_count
            })
            .select('id')
            .single();

        if (documentError) {
            console.error('[Supabase] Erreur insertion document:', documentError);
            throw documentError;
        }

        const documentId = documentData.id;
        console.log('[Supabase] Document inséré avec ID:', documentId);

        // 2. Insérer les tournées
        const tourneesWithDocId = payload.tournees.map(t => ({
            document_id: documentId,
            tournee: t.tournee,
            nom: t.nom,
            deb_tour: t.deb_tour,
            fin_tour: t.fin_tour,
            cl_veh: t.cl_veh,
            employe: t.employe,
            nom_employe: t.nom_employe,
            employe_confirm: t.employe_confirm,
            vehicule: t.vehicule,
            cl_veh_aff: t.cl_veh_aff,
            autoris: t.autoris,
            approuve: t.approuve,
            retour: t.retour,
            adresse_debut: t.adresse_debut,
            adresse_fin: t.adresse_fin
        }));

        const { error: tourneesError } = await supabase
            .from('tct_tournees')
            .insert(tourneesWithDocId);

        if (tourneesError) {
            console.error('[Supabase] Erreur insertion tournées:', tourneesError);
            throw tourneesError;
        }

        console.log('[Supabase] Tournées insérées:', tourneesWithDocId.length);

        // 3. Logger dans l'historique
        const executionTime = Date.now() - startTime;
        const { error: historyError } = await supabase
            .from('tct_history')
            .insert({
                document_id: documentId,
                action: 'extraction_saved',
                status: 'success',
                message: `Document ${payload.document.filename} traité avec ${payload.tournees.length} tournées`,
                execution_time_ms: executionTime
            });

        if (historyError) {
            console.warn('[Supabase] Erreur log historique (non bloquant):', historyError);
        }

        console.log('[Supabase] Sauvegarde complète réussie en', executionTime, 'ms');

        return {
            success: true,
            documentId,
            tourneesCount: tourneesWithDocId.length,
            executionTime
        };

    } catch (error: any) {
        console.error('[Supabase] Erreur sauvegarde:', error);

        // Logger l'erreur dans l'historique
        try {
            await supabase
                .from('tct_history')
                .insert({
                    action: 'extraction_failed',
                    status: 'error',
                    message: error?.message || 'Erreur inconnue',
                    execution_time_ms: Date.now() - startTime
                });
        } catch (logError) {
            console.warn('[Supabase] Impossible de logger l\'erreur:', logError);
        }

        throw error;
    }
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
