
import { TableData } from '../types';
import { User } from '../components/AuthPage';

const CONFIG_KEY = 'adt_airtable_config';

interface AirtableConfig {
    apiKey: string;
    baseId: string;
}

export const getAirtableConfig = (): AirtableConfig | null => {
    try {
        const stored = localStorage.getItem(CONFIG_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
};

export const saveAirtableConfig = (config: AirtableConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

// --- API CLIENT ---

const apiCall = async (endpoint: string, method: string = 'GET', body: any = null) => {
    const config = getAirtableConfig();
    if (!config) throw new Error("Airtable n'est pas configuré.");

    const headers = {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
    };

    const response = await fetch(`https://api.airtable.com/v0/${config.baseId}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Airtable Error: ${response.statusText}`);
    }

    return response.json();
};

// --- UTILISATEURS ---

export const fetchUsers = async (): Promise<User[]> => {
    try {
        const data = await apiCall('/Utilisateurs?maxRecords=100&view=Grid%20view');
        return data.records.map((r: any) => ({
            numDome: r.fields.numDome || '',
            idEmploye: r.fields.idEmploye || '',
            telephone: r.fields.telephone || '',
            email: r.fields.email || ''
        })).filter((u: User) => u.numDome && u.idEmploye);
    } catch (e) {
        // En mode silencieux si config manquante, sinon log l'erreur
        const config = getAirtableConfig();
        if (config) {
             console.error("Erreur fetchUsers", e);
        }
        // Fallback local
        return JSON.parse(localStorage.getItem('edt_users') || '[]');
    }
};

export const createUser = async (user: User): Promise<void> => {
    const config = getAirtableConfig();

    if (config) {
        // Mode Cloud (Airtable)
        await apiCall('/Utilisateurs', 'POST', {
            records: [{
                fields: {
                    numDome: user.numDome,
                    idEmploye: user.idEmploye,
                    telephone: user.telephone,
                    email: user.email
                }
            }]
        });
    } else {
        // Mode Local (Fallback)
        // Permet de créer un compte même sans configuration Cloud pour éviter l'erreur bloquante
        console.warn("Airtable non configuré : Création utilisateur en local.");
        const localUsers = JSON.parse(localStorage.getItem('edt_users') || '[]');
        // Vérifier doublon local
        if (!localUsers.find((u: User) => u.numDome === user.numDome && u.idEmploye === user.idEmploye)) {
            localUsers.push(user);
            localStorage.setItem('edt_users', JSON.stringify(localUsers));
        }
    }
};

// --- TOURNEES (Tableau Final) ---

export const fetchTournees = async (): Promise<TableData | null> => {
    try {
        const config = getAirtableConfig();
        if (!config) return null;

        const data = await apiCall('/Tournees?maxRecords=500'); // Limite 500 pour sécurité
        
        if (!data.records || data.records.length === 0) return null;

        const headers = [
            "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
            "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
            "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin",
            "Changement", "Changement par"
        ];

        const rows = data.records.map((r: any) => {
            return headers.map(h => r.fields[h] || '');
        });

        return { headers, rows };

    } catch (e) {
        console.warn("Impossible de récupérer les tournées Airtable", e);
        return null;
    }
};

export const syncTournees = async (tableData: TableData): Promise<void> => {
    // Si pas de config, on ne fait rien (pas d'erreur, juste pas de sync cloud)
    const config = getAirtableConfig();
    if (!config) return;

    const records = tableData.rows.map(row => {
        const fields: any = {};
        tableData.headers.forEach((h, index) => {
            fields[h] = row[index] || '';
        });
        return { fields };
    });

    const BATCH_SIZE = 10;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await apiCall('/Tournees', 'POST', { records: batch });
    }
};
