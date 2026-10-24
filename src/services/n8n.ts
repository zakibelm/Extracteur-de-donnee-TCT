import { getExtractionKey, getExtractionModel } from './extractionSettings';
import { supabase } from '../lib/supabaseClient';
import { TableData } from '../types';
import { validateTable, TCT_HEADERS } from '../utils/table';

export async function extractDocumentViaN8n(image: string, section: 'tct' | 'olymel', mimeType: string): Promise<TableData> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Connectez-vous pour extraire un document.');
    const response = await fetch('/api/n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(getExtractionKey() ? { 'X-API-Key': getExtractionKey() } : {}) },
        body: JSON.stringify({ image, section, mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType, model: getExtractionModel() }),
        signal: AbortSignal.timeout(130_000),
    });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); }
    catch { throw new Error(`Le serveur n'a pas pu analyser le document (HTTP ${response.status}). Réessayez avec une image plus petite.`); }
    if (!response.ok) throw new Error(result.error || 'Échec extraction.');
    return validateTable(result, section === 'tct' ? TCT_HEADERS : undefined);
}
