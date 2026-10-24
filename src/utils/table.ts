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
    const metadata = table.metadata ? { ...table.metadata } : undefined;
    if (metadata?.schedule_code) {
        const code = metadata.schedule_code;
        if (typeof code !== 'string' || !/^\d{8}$/.test(code)) throw new Error('Code horaire invalide.');
        metadata.schedule_date = code.slice(0,4) + '-' + code.slice(4,6) + '-' + code.slice(6,8);
    }
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
    const metadata = valid.find(d => d.content!.metadata?.schedule_date)?.content!.metadata || valid[0].content!.metadata;
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

export const TCT_DISPATCH_HEADERS = ['Tournée', 'Nom', 'Déb tour', 'Fin tour', 'Cl véh', 'Employé',
    "Nom de l'employé", 'Employé (2)', 'Véhicule', 'Cl véh aff', 'Autoris', 'Approuvé',
    'Retour', 'Statut FDR', 'Adresse de début', 'Adresse de fin'] as const;
export const TCT_DISPATCH_FIELDS = ['tournee','nom','deb_tour','fin_tour','cl_veh','employe',
    'nom_employe','employe_affecte','vehicule','cl_veh_aff','autoris','approuve',
    'retour','statut_fdr','adresse_debut','adresse_fin'] as const;
export const TCT_ALL_FIELDS = [...TCT_FIELDS, 'employe_affecte', 'autoris', 'retour', 'statut_fdr'] as const;
export type TctLayout = 'dispatch_14' | 'dispatch_16';
export function tctLayout(headers: readonly string[]): TctLayout {
    const matches = (expected: readonly string[]) => headers.length === expected.length && headers.every((h,i) => h === expected[i]);
    if (matches(TCT_HEADERS)) return 'dispatch_14';
    if (matches(TCT_DISPATCH_HEADERS)) return 'dispatch_16';
    throw new Error('Structure TCT non reconnue. Utilisez le tableau complet avec tous ses en-têtes.');
}
export function validateTctTable(input: unknown): TableData {
    const table = validateTable(input);
    const layout = tctLayout(table.headers);
    if (table.metadata?.source_layout && table.metadata.source_layout !== layout) throw new Error('Colonnes incompatibles avec le format annoncé.');
    if (layout === 'dispatch_16' && table.rows.some(row => /^\d+$/.test(row[TCT_DISPATCH_HEADERS.indexOf('Cl véh aff')].trim()))) {
        throw new Error('Décalage de colonnes détecté : Cl véh aff contient un numéro au lieu d’un type de véhicule. Réanalysez le document.');
    }
    return { ...table, metadata: { ...table.metadata, source_layout: layout } };
}
export function normalizeTctExtraction(raw: any): TableData {
    if (Array.isArray(raw?.headers)) return validateTctTable(raw);
    const layout = raw?.source_layout;
    if (!['dispatch_14','dispatch_16'].includes(layout) || !Array.isArray(raw?.rows)) throw new Error('Format source TCT absent.');
    const fields = layout === 'dispatch_16' ? TCT_DISPATCH_FIELDS : TCT_FIELDS;
    const headers = layout === 'dispatch_16' ? TCT_DISPATCH_HEADERS : TCT_HEADERS;
    const rows = raw.rows.map((row: any) => {
        if (!row || fields.some(field => typeof row[field] !== 'string')) throw new Error('Champs TCT incomplets.');
        return fields.map(field => row[field]);
    });
    return validateTctTable({ headers: [...headers], rows, metadata: { ...raw.metadata, source_layout: layout, schema_version: 2 } });
}
export function toTctRecords(table: TableData) {
    const validated = validateTctTable(table);
    const fields = tctLayout(validated.headers) === 'dispatch_16' ? TCT_DISPATCH_FIELDS : TCT_FIELDS;
    return validated.rows.map(row => {
        const record = Object.fromEntries(fields.map((field,i) => [field,row[i]]));
        if (fields === TCT_DISPATCH_FIELDS) { record.stationnement = ''; record.territoire_debut = ''; }
        return record as Record<typeof TCT_FIELDS[number], string> & Partial<Record<'employe_affecte'|'autoris'|'retour'|'statut_fdr',string>>;
    });
}
