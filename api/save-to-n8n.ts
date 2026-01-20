import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { document, tournees, user_id } = req.body;

        if (!document || !tournees || !user_id) {
            return res.status(400).json({
                error: 'Missing required fields: document, tournees, user_id'
            });
        }

        const N8N_BASE_URL = 'https://n8n.srv679767.hstgr.cloud';
        const startTime = Date.now();

        // Construire le payload complet
        const payload = {
            document,
            tournees,
            user_id,
            timestamp: new Date().toISOString()
        };

        console.log('[N8N API] Envoi des données:', {
            filename: document.filename,
            tournees_count: tournees.length,
            user_id
        });

        // URL du webhook n8n pour l'upload de documents TCT
        const webhookUrl = `${N8N_BASE_URL}/webhook/tct-upload-document`;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`N8N Webhook Error (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        const executionTime = Date.now() - startTime;

        console.log('[N8N API] Données sauvegardées:', {
            documentId: result.document_id,
            execution_time_ms: executionTime
        });

        // Logger l'historique
        try {
            const historyUrl = `${N8N_BASE_URL}/webhook/tct-history`;
            await fetch(historyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    document_id: result.document_id,
                    action: 'extraction_saved',
                    status: 'success',
                    message: `Extraction réussie: ${tournees.length} tournées`,
                    execution_time_ms: executionTime,
                    created_at: new Date().toISOString()
                })
            });
        } catch (historyError) {
            console.warn('[N8N API] Failed to log history:', historyError);
        }

        return res.status(200).json({
            success: true,
            documentId: result.document_id,
            execution_time_ms: executionTime
        });

    } catch (error: any) {
        console.error('[N8N API] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}
