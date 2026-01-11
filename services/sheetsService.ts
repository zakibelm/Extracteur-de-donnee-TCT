import { TableData } from '../types';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyEu_rh7mi1-w4PBpe4thBWtDdXVQlZgVKdhEXDvXl1j4-eX5W-n5Wno6Cy8iP-qdc/exec';


export const sheetsService = {
    /**
     * Récupère les données depuis Google Sheets
     */
    async fetchFromGoogleSheets(
        numDome?: string
    ): Promise<{ success: boolean; data: TableData | null; error?: string }> {
        try {
            // Utilisation de l'action getHistory comme dans l'exemple fonctionnel
            const baseUrl = `${APPS_SCRIPT_URL}?action=getHistory`;
            const url = numDome
                ? `${baseUrl}&numDome=${encodeURIComponent(numDome)}`
                : baseUrl;

            console.log('📥 Chargement depuis Google Sheets:', { url, numDome });

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Données reçues de Google Sheets:', {
                success: result.success,
                totalRows: result.totalRows,
                headersCount: result.headers?.length
            });

            if (!result.success) {
                throw new Error(result.error || 'Erreur inconnue');
            }

            // Extraire les en-têtes de données (sans Timestamp, User, NumDome)
            const dataHeaders = result.headers.slice(3);
            const dataRows = result.rows.map((row: any[]) => row.slice(3));

            return {
                success: true,
                data: {
                    headers: dataHeaders,
                    rows: dataRows
                }
            };
        } catch (error) {
            console.error('❌ Erreur chargement Google Sheets:', error);
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            };
        }
    },

    /**
     * Exporte un tableau consolidé vers Google Sheets
     */
    async exportConsolidatedTable(
        numDome: string,
        userEmail: string | undefined,
        tableData: TableData
    ): Promise<{ success: boolean; message: string }> {
        try {
            const payload = {
                action: 'save_consolidated',
                numDome,
                userEmail: userEmail || numDome,
                headers: tableData.headers,
                rows: tableData.rows,
            };

            console.log('📤 Envoi vers Google Sheets:', {
                url: APPS_SCRIPT_URL,
                numDome,
                userEmail,
                rowCount: tableData.rows.length,
                headerCount: tableData.headers.length
            });
            console.log('📦 Payload complet:', JSON.stringify(payload).substring(0, 500) + '...');

            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'no-cors',
                body: JSON.stringify(payload),
            });

            console.log('📥 Réponse Google Sheets:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            const responseText = await response.text();
            console.log('📝 Contenu réponse:', responseText);

            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}: ${responseText}`);
            }

            // Parser la réponse JSON
            const result = JSON.parse(responseText);
            console.log('✅ Résultat parsé:', result);

            return {
                success: result.success || true,
                message: result.rowsAdded
                    ? `${result.rowsAdded} lignes exportées vers Google Sheets`
                    : `${tableData.rows.length} lignes exportées vers Google Sheets`,
            };
        } catch (error) {
            console.error('❌ Erreur export Google Sheets:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Erreur inconnue',
            };
        }
    },

    /**
     * Sauvegarde un utilisateur dans Google Sheets (backup)
     */
    async backupUser(user: {
        numDome: string;
        idEmploye: string;
        email?: string;
        telephone?: string;
        isAdmin: boolean;
    }): Promise<void> {
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'save_user',
                    ...user,
                }),
            });
            console.log('User backup envoyé à Google Sheets');
        } catch (error) {
            console.error('Erreur backup user:', error);
        }
    },
};
