import { supabase } from '../lib/supabaseClient';
import { TableData } from '../types';
import { validateTable, TCT_HEADERS } from '../utils/table';

export async function extractDocumentViaN8n(image: string, section: 'tct' | 'olymel', mimeType: string): Promise<TableData> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Connectez-vous pour extraire un document.');
    const response = await fetch('/api/n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image, section, mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType }),
        signal: AbortSignal.timeout(120_000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Échec extraction.');
    return validateTable(result, section === 'tct' ? TCT_HEADERS : undefined);
}
