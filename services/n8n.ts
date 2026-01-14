
import { TableData } from '../types';
import { User } from '../components/AuthPage';

const CONFIG_KEY = 'adt_n8n_config';

// Webhooks par défaut fournis
export const DEFAULT_LOGIN_WEBHOOK = 'https://n8n.srv679767.hstgr.cloud/webhook-test/tctn-login';
export const DEFAULT_REGISTER_WEBHOOK = 'https://n8n.srv679767.hstgr.cloud/webhook-test/tctn-register';
export const DEFAULT_GET_TOURNEES_WEBHOOK = 'https://n8n.srv679767.hstgr.cloud/webhook-test/tctn-get-tournees';
export const DEFAULT_SYNC_TOURNEES_WEBHOOK = 'https://n8n.srv679767.hstgr.cloud/webhook-test/tctn-upload-document-final';
export const DEFAULT_CHANGE_REQUEST_WEBHOOK = 'https://n8n.srv679767.hstgr.cloud/webhook-test/tctn-demande-changement';

interface N8nConfig {
    usersWebhook: string;       // GET: Liste utilisateurs
    registerWebhook: string;    // POST: Création compte
    getTourneesWebhook: string; // GET: Récupération des tournées
    syncTourneesWebhook: string;// POST: Synchronisation/Sauvegarde des tournées
    changeRequestWebhook: string;// POST: Log/Notification d'un changement unitaire
}

export const getN8nConfig = (): N8nConfig | null => {
    try {
        const stored = localStorage.getItem(CONFIG_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                usersWebhook: parsed.usersWebhook || DEFAULT_LOGIN_WEBHOOK,
                registerWebhook: parsed.registerWebhook || DEFAULT_REGISTER_WEBHOOK,
                getTourneesWebhook: parsed.getTourneesWebhook || DEFAULT_GET_TOURNEES_WEBHOOK,
                syncTourneesWebhook: parsed.syncTourneesWebhook || DEFAULT_SYNC_TOURNEES_WEBHOOK,
                changeRequestWebhook: parsed.changeRequestWebhook || DEFAULT_CHANGE_REQUEST_WEBHOOK
            };
        }
        return null;
    } catch {
        return null;
    }
};

export const saveN8nConfig = (config: N8nConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

// --- API CLIENT ---

const apiCall = async (url: string, method: string = 'GET', body: any = null) => {
    if (!url) throw new Error("URL Webhook non configurée pour cette action.");

    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };

    // CORRECTION CORS MAJEURE :
    // On force 'text/plain' au lieu de 'application/json' pour les requêtes POST.
    // Cela transforme la requête en "Simple Request" et empêche le navigateur
    // d'envoyer une requête de pré-vérification (OPTIONS) qui échoue souvent avec n8n.
    // n8n détectera quand même le JSON dans le corps du message.
    if (body && method !== 'GET' && method !== 'HEAD') {
        headers['Content-Type'] = 'text/plain';
    }

    const options: RequestInit = {
        method,
        headers,
        mode: 'cors',
        credentials: 'omit', // Pas de cookies nécessaires
        cache: 'no-store' // Toujours récupérer la dernière version
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`N8n Error ${response.status}: ${text || response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        // Utilisation de warn au lieu de error pour ne pas alarmer l'utilisateur sur des problèmes réseau (mode offline)
        console.warn(`[N8n] Échec de l'appel (${method}) vers ${url}:`, error);
        throw error;
    }
};

// --- UTILISATEURS ---

export const fetchUsers = async (): Promise<User[]> => {
    const config = getN8nConfig();
    const url = config?.usersWebhook || DEFAULT_LOGIN_WEBHOOK;

    console.info(`[N8n] Tentative de récupération des utilisateurs via ${url}`);

    if (!url) {
        return JSON.parse(localStorage.getItem('edt_users') || '[]');
    }

    try {
        const data = await apiCall(url, 'GET');
        const usersArray = Array.isArray(data) ? data : (data.users || data.data || []);
        
        return usersArray.map((r: any) => ({
            numDome: r.numDome || '',
            idEmploye: r.idEmploye || '',
            telephone: r.telephone || '',
            email: r.email || ''
        })).filter((u: User) => u.numDome && u.idEmploye);
    } catch (e) {
        console.warn("Impossible de récupérer les utilisateurs n8n (Fallback local)", e);
        return JSON.parse(localStorage.getItem('edt_users') || '[]');
    }
};

export const createUser = async (user: User): Promise<any> => {
    const config = getN8nConfig();
    const url = config?.registerWebhook || DEFAULT_REGISTER_WEBHOOK;

    console.info(`[N8n] Tentative d'inscription utilisateur via ${url}`);

    if (url) {
        return await apiCall(url, 'POST', {
            action: 'create_user',
            user: {
                numDome: user.numDome,
                idEmploye: user.idEmploye,
                telephone: user.telephone,
                email: user.email
            }
        });
    } else {
        console.warn("n8n Register non configuré : Création locale.");
        const localUsers = JSON.parse(localStorage.getItem('edt_users') || '[]');
        if (!localUsers.find((u: User) => u.numDome === user.numDome && u.idEmploye === user.idEmploye)) {
            localUsers.push(user);
            localStorage.setItem('edt_users', JSON.stringify(localUsers));
        }
        return { status: 'local_created' };
    }
};

// --- TOURNEES (Tableau Final) ---

export const fetchTournees = async (): Promise<TableData | null> => {
    const config = getN8nConfig();
    const url = config?.getTourneesWebhook || DEFAULT_GET_TOURNEES_WEBHOOK;

    if (!url) return null;

    try {
        const data = await apiCall(url, 'GET');
        
        if (Array.isArray(data)) {
            if (data.length === 0) return null;

            const allHeaders = new Set<string>();
            data.forEach((row: any) => Object.keys(row).forEach(k => {
                if (k !== 'id' && k !== '_id' && !k.startsWith('metadata')) allHeaders.add(k);
            }));
            
            const PREFERRED_ORDER = [
                "Tournée", "Nom", "Début tournée", "Fin tournée", "Classe véhicule", "Employé",
                "Nom de l'employé", "Véhicule", "Classe véhicule affecté", "Stationnement",
                "Approuvé", "Territoire début", "Adresse de début", "Adresse de fin",
                "Changement", "Changement par"
            ];
            
            const sortedHeaders = Array.from(allHeaders).sort((a, b) => {
                const idxA = PREFERRED_ORDER.indexOf(a);
                const idxB = PREFERRED_ORDER.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            const rows = data.map((obj: any) => sortedHeaders.map(h => {
                const val = obj[h];
                return (val === null || val === undefined) ? '' : String(val);
            }));

            return { headers: sortedHeaders, rows };
        }
        
        return null;
    } catch (e) {
        console.warn("Impossible de récupérer les tournées n8n", e);
        return null;
    }
};

export const syncTournees = async (tableData: TableData): Promise<void> => {
    const config = getN8nConfig();
    const url = config?.syncTourneesWebhook || DEFAULT_SYNC_TOURNEES_WEBHOOK;
    
    if (!url) {
        console.warn("Webhook de synchronisation (POST) non configuré.");
        return;
    }

    const records = tableData.rows.map(row => {
        const obj: any = {};
        tableData.headers.forEach((h, i) => {
            obj[h] = row[i] || "";
        });
        return obj;
    });

    await apiCall(url, 'POST', {
        action: 'upload_document_final',
        timestamp: new Date().toISOString(),
        data: records
    });
};

/**
 * Envoie une notification de changement unitaire à n8n.
 * Utile pour déclencher des automatisations spécifiques (Slack, Email, Log) sans renvoyer tout le tableau.
 */
export const sendChangeRequest = async (changeData: {
    tournee: string;
    oldValue: string;
    newValue: string;
    user: string;
    fullRow?: string[];
}): Promise<void> => {
    const config = getN8nConfig();
    const url = config?.changeRequestWebhook || DEFAULT_CHANGE_REQUEST_WEBHOOK;
    
    if (!url) return;

    await apiCall(url, 'POST', {
        action: 'demande_changement',
        timestamp: new Date().toISOString(),
        ...changeData
    });
};
