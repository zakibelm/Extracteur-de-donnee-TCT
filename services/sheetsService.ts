import { TableData } from '../types';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwHdrGTrLhF8vplKoMKijD-L_awo5uZHhLgmKtKBuGWuL9a3wO9n2SSv_Q9ZfGGQIA/exec';


export const sheetsService = {
    /**
     * Exporte un tableau consolidé vers Google Sheets
     */
    async exportConsolidatedTable(
        numDome: string,
        userEmail: string | undefined,
        tableData: TableData
    ): Promise<{ success: boolean; message: string }> {
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Apps Script nécessite no-cors
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'save_consolidated',
                    numDome,
                    userEmail: userEmail || numDome,
                    headers: tableData.headers,
                    rows: tableData.rows,
                }),
            });

            // Avec no-cors, on ne peut pas lire la réponse
            // On considère que c'est réussi si pas d'erreur
            return {
                success: true,
                message: `${tableData.rows.length} lignes exportées vers Google Sheets`,
            };
        } catch (error) {
            console.error('Erreur export Google Sheets:', error);
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
