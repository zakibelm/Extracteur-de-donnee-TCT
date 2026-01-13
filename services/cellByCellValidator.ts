export interface Cell {
    column_header: string;
    value: string;
    verified?: boolean;
}

export interface AIResponseRow {
    row_number: number;
    cells: Cell[];
}

export interface AIResponse {
    phase: string;
    headers_detected: string[];
    data: AIResponseRow[];
}

export interface SQLRow {
    tournee: string;
    nom_compagnie: string;
    debut_tournee: string;
    fin_tournee: string;
    classe_vehicule: string;
    id_employe: string;
    nom_employe_complet: string;
    id_employe_confirm?: string;
    vehicule: string;
    changement?: string;
    changement_par?: string;
    classe_vehicule_affecte: string;
    autorisation: string;
    approuve: string;
    retour: string;
    adresse_debut: string;
    adresse_fin: string;
}

export interface ValidationResult {
    success: boolean;
    validRows: SQLRow[];
    errors: { row: number; errors: string[] }[];
}

// Normalisation des headers pour matcher malgré les petites variations
const normalizeHeader = (h: string) => h.toLowerCase().trim()
    .replace(/[éèê]/g, 'e')
    .replace('tournée', 'tour')
    .replace('vehicule', 'veh');

export function validateAndConvertAIResponse(response: AIResponse): ValidationResult {
    const validRows: SQLRow[] = [];
    const errors: { row: number; errors: string[] }[] = [];

    if (!response.data || !Array.isArray(response.data)) {
        return { success: false, validRows: [], errors: [{ row: 0, errors: ["Format de réponse invalide: 'data' manquant"] }] };
    }

    response.data.forEach((row) => {
        const rowErrors: string[] = [];
        const sqlRow: Partial<SQLRow> = {};

        // Empêcher les doublons lors du mapping (ex: 2 colonnes Employé)
        let employeCount = 0;

        row.cells.forEach(cell => {
            const header = normalizeHeader(cell.column_header);
            const val = String(cell.value).trim();

            if (header.includes('tournee') || header === 'tour') {
                sqlRow.tournee = val;
            } else if (header === 'nom' || header.includes('compagnie')) {
                sqlRow.nom_compagnie = val;
            } else if (header.includes('deb') && header.includes('tour')) {
                sqlRow.debut_tournee = val;
            } else if (header.includes('fin') && header.includes('tour')) {
                sqlRow.fin_tournee = val;
            } else if (header.includes('cl') && header.includes('veh') && !header.includes('aff')) {
                // "Cl véh" mais pas "Cl véh aff"
                sqlRow.classe_vehicule = val;
            } else if (header === 'employe' || header === 'employ') {
                employeCount++;
                if (employeCount === 1) {
                    sqlRow.id_employe = val;
                } else {
                    sqlRow.id_employe_confirm = val;
                }
            } else if (header.includes('nom') && header.includes('emp')) {
                sqlRow.nom_employe_complet = val;
            } else if (header === 'vehicule' || header === 'veh') {
                sqlRow.vehicule = val;
            } else if (header.includes('chang') && !header.includes('par')) {
                sqlRow.changement = val;
            } else if (header.includes('chang') && header.includes('par')) {
                sqlRow.changement_par = val;
            } else if (header.includes('cl') && header.includes('aff')) {
                sqlRow.classe_vehicule_affecte = val;
            } else if (header.includes('auto') || header.includes('stationnement')) {
                sqlRow.autorisation = val;
            } else if (header.includes('approuv')) {
                sqlRow.approuve = val;
            } else if (header.includes('retour') || header.includes('territ')) {
                sqlRow.retour = val;
            } else if (header.includes('adr') && header.includes('deb')) {
                sqlRow.adresse_debut = val;
            } else if (header.includes('adr') && header.includes('fin')) {
                sqlRow.adresse_fin = val;
            }
        });

        // Validation des champs requis
        if (!sqlRow.tournee) rowErrors.push("Tournée manquante");
        // if (!sqlRow.id_employe) rowErrors.push("ID Employé manquant"); 
        // (Parfois vide si pas assigné, on peut être souple sauf sur la structure)

        if (rowErrors.length > 0) {
            errors.push({ row: row.row_number, errors: rowErrors });
        } else {
            // Remplir les vides
            const finalRow: SQLRow = {
                tournee: sqlRow.tournee || '',
                nom_compagnie: sqlRow.nom_compagnie || '',
                debut_tournee: sqlRow.debut_tournee || '',
                fin_tournee: sqlRow.fin_tournee || '',
                classe_vehicule: sqlRow.classe_vehicule || '',
                id_employe: sqlRow.id_employe || '',
                nom_employe_complet: sqlRow.nom_employe_complet || '',
                id_employe_confirm: sqlRow.id_employe_confirm || '',
                vehicule: sqlRow.vehicule || '',
                changement: sqlRow.changement || '',
                changement_par: sqlRow.changement_par || '',
                classe_vehicule_affecte: sqlRow.classe_vehicule_affecte || '',
                autorisation: sqlRow.autorisation || '',
                approuve: sqlRow.approuve || '',
                retour: sqlRow.retour || '',
                adresse_debut: sqlRow.adresse_debut || '',
                adresse_fin: sqlRow.adresse_fin || ''
            };
            validRows.push(finalRow);
        }
    });

    return {
        success: validRows.length > 0,
        validRows,
        errors
    };
}

export function debugLogRow(row: AIResponseRow, detectedHeaders: string[]) {
    console.log(`\n=== DEBUG LIGNE ${row.row_number} ===`);
    console.table(row.cells.map((c, i) => ({
        Idx: i,
        DetectedHeader: detectedHeaders[i] || '?',
        CellHeader: c.column_header,
        Value: c.value
    })));
}
