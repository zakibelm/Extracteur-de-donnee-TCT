import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nmmmlsgvhupzdunclcvj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tbW1sc2d2aHVwemR1bmNsY3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MTcxNTEsImV4cCI6MjA1Mjk5MzE1MX0.VYqW_-_jfhm5tNjGDJjEE71LGOM0LEixr2WqfKDUuoE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types pour la base de données
export interface TctDocument {
    id?: number;
    filename: string;
    upload_date: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    user_id: string;
    extracted_count: number;
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
    employe_confirm: string;
    vehicule: string;
    cl_veh_aff: string;
    autoris: string;
    approuve: string;
    retour: string;
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
