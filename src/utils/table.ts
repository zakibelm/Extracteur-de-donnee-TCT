import { ExtractedData, Status, TableData } from '../types.js';

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
    const metadata = table.metadata;
    if (metadata && (typeof metadata !== 'object' || Array.isArray(metadata))) throw new Error('Métadonnées invalides.');
    if (metadata?.schedule_date && (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.schedule_date) ||
        new Date(metadata.schedule_date).toISOString().slice(0, 10) !== metadata.schedule_date)) {
        throw new Error('Date horaire invalide.');
    }
    return { headers: [...table.headers], rows: table.rows.map(row => [...row]), ...(metadata ? { metadata } : {}) };
}

export function buildUnifiedTable(extractions: ExtractedData[]): TableData | null {
    const valid = extractions.filter(d => d.status === Status.Success && d.content?.rows.length);
    if (!valid.length) return null;
    const headers = valid[0].content!.headers;
    const dates = new Set(valid.map(d => d.content!.metadata?.schedule_date).filter(Boolean));
    if (dates.size > 1) throw new Error('Les documents ont des dates horaires différentes.');
    const metadata = valid.find(d => d.content!.metadata?.schedule_date)?.content!.metadata;
    const rows = valid.flatMap(d => validateTable(d.content, headers).rows);
    return { headers: [...headers], ...(metadata ? { metadata } : {}), rows: Array.from(new Set(rows.map(row => JSON.stringify(row))))
        .map(row => JSON.parse(row) as string[]) };
}

export const TCT_HEADERS = ['Tournée', 'Nom', 'Déb tour', 'Fin tour', 'Classe véh', 'Employé',
    "Nom de l'employé", 'Véhicule', 'Cl véh aff', 'Stationnement', 'Approuvé',
    'Terr début', 'Adresse de début', 'Adresse de fin'] as const;

export const TCT_FIELDS = ['tournee', 'nom', 'deb_tour', 'fin_tour', 'cl_veh', 'employe',
    'nom_employe', 'vehicule', 'cl_veh_aff', 'stationnement', 'approuve',
    'territoire_debut', 'adresse_debut', 'adresse_fin'] as const;

export function toTctRecords(table: TableData): Record<typeof TCT_FIELDS[number], string>[] {
    const validated = validateTable(table, TCT_HEADERS);
    return validated.rows.map(row => {
        return Object.fromEntries(TCT_FIELDS.map((field, i) => [field, row[i]])) as Record<typeof TCT_FIELDS[number], string>;
    });
}
