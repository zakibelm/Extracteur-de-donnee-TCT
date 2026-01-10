import { TableData } from '../types';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykQd3fYsigmcEPHU7bZMGtWuJVJc7EWuxnOUZkwiG5S_8bcux1pltTqTCEYFoV-Q/exec';


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

            return {
                success: true,
                message: `${tableData.rows.length} lignes exportées vers Google Sheets`,
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
