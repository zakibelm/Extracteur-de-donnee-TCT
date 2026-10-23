import { ExtractedData, Status, TableData } from '../types';

export function validateTable(input: unknown, expectedHeaders?: readonly string[]): TableData {
    const table = input as TableData;
    if (!table || !Array.isArray(table.headers) || !table.headers.length ||
        !table.headers.every(h => typeof h === 'string') ||
        new Set(table.headers).size !== table.headers.length || !Array.isArray(table.rows)) {
        throw new Error('Structure du tableau invalide.');
    }
    if (expectedHeaders && (table.headers.length !== expectedHeaders.length ||
        table.headers.some((h, i) => h !== expectedHeaders[i]))) {
        throw new Error('Les colonnes ne correspondent pas au document attendu.');
    }
    if (table.rows.some(row => !Array.isArray(row) || row.length !== table.headers.length ||
        row.some(cell => typeof cell !== 'string'))) {
        throw new Error('Alignement invalide : chaque ligne doit correspondre exactement aux en-têtes.');
    }
    return { headers: [...table.headers], rows: table.rows.map(row => [...row]) };
}

export function buildUnifiedTable(extractions: ExtractedData[]): TableData | null {
    const valid = extractions.filter(d => d.status === Status.Success && d.content?.rows.length);
    if (!valid.length) return null;
    const headers = valid[0].content!.headers;
    const rows = valid.flatMap(d => validateTable(d.content, headers).rows);
    return { headers: [...headers], rows: Array.from(new Set(rows.map(row => JSON.stringify(row))))
        .map(row => JSON.parse(row) as string[]) };
}

export const TCT_HEADERS = ['Tournée', 'Nom', 'Déb tour', 'Fin tour', 'Cl véh', 'Employé',
    "Nom de l'employé", 'Employé (Confirm)', 'Véhicule', 'Cl véh aff', 'Autoris',
    'Approuvé', 'Retour', 'Adresse de début', 'Adresse de fin'] as const;
