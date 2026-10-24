import type { DocumentMetadata } from '../types';
import { createClient } from '@supabase/supabase-js';

import { PROJECT_URL, PROJECT_PUBLISHABLE_KEY } from '../config/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PROJECT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || PROJECT_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types pour la base de données
export interface TctDocument {
    id?: number;
    filename: string;
    upload_date: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    user_id: string;
    extracted_count: number;
    source_metadata?: DocumentMetadata;
    created_at?: string;
}

export interface TctTournee {
    id?: number;
    document_id: number;
    tournee: string;
    nom: string;
    deb_tour: string;
    fin_tour: string;
    cl_veh: string;
    employe: string;
    nom_employe: string;
    employe_affecte?: string;
    autoris?: string;
    retour?: string;
    statut_fdr?: string;
    vehicule: string;
    cl_veh_aff: string;
    stationnement: string;
    approuve: string;
    territoire_debut: string;
    adresse_debut: string;
    adresse_fin: string;
    created_at?: string;
}

export interface TctHistory {
    id?: number;
    document_id?: number;
    action: string;
    status: 'success' | 'error';
    message?: string;
    execution_time_ms?: number;
    created_at?: string;
}
