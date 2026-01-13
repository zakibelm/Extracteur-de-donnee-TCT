
// services/coordinateValidator.ts
// Validation STRICTE des coordonnées avant injection SQL

export interface CellWithCoordinates {
    position: number;
    header: string;
    value: any;
    x_read_from?: number;
}

export interface RowWithCoordinates {
    row_number: number;
    y_position?: number;
    cells_by_position: Record<string, CellWithCoordinates>;
}

/**
 * Table de mapping: Position → Colonne SQL attendue
 */
export const POSITION_TO_SQL_COLUMN: Record<number, string> = {
    1: 'tournee',
    2: 'nom_compagnie',
    3: 'debut_tournee',
    4: 'fin_tournee',
    5: 'classe_vehicule',
    6: 'id_employe',
    7: 'nom_employe_complet',
    8: 'id_employe_confirm',
    9: 'vehicule',
    10: 'classe_vehicule_affecte',
    11: 'autorisation',
    12: 'approuve',
    13: 'retour',
    14: 'adresse_debut',
    15: 'adresse_fin',
    16: 'changement',
    17: 'changement_par'
};

/**
 * Headers attendus par position
 */
export const EXPECTED_HEADERS: Record<number, string[]> = {
    1: ['Tournée', 'Tournee', 'No tournée'],
    2: ['Nom', 'Nom compagnie', 'Compagnie'],
    3: ['Déb tour', 'Deb tour', 'Début tour', 'Debut tournee'],
    4: ['Fin tour', 'Fin tournée', 'Fin tournee'],
    5: ['Cl véh', 'Cl veh', 'Classe véh', 'Classe vehicule'],
    6: ['Employé', 'Employe', 'ID employé', 'No employé'],
    7: ['Nom de l\'employé', 'Nom employé', 'Nom emp'],
    8: ['Employé', 'Employe', 'ID employé', 'No employé'], // 2ème occurrence
    9: ['Véhicule', 'Vehicule', 'No véhicule', 'Veh'],
    10: ['Cl véh aff', 'Cl veh aff', 'Classe aff'],
    11: ['Autoris', 'Autorisation', 'Auth'],
    12: ['Approuvé', 'Approuve', 'Validé', 'Valide'],
    13: ['Retour', 'Retour chauffeur'],
    14: ['Adresse de début', 'Adresse debut', 'Adr debut', 'Départ'],
    15: ['Adresse de fin', 'Adresse fin', 'Adr fin', 'Arrivée'],
    16: ['Changement', 'Change', 'Modif'],
    17: ['Changement par', 'Change par', 'Modifié par']
};

/**
 * VALIDATION 1: Vérifie que toutes les positions 1-17 sont présentes
 */
function validateAllPositionsPresent(row: RowWithCoordinates): {
    valid: boolean;
    missing: number[];
    error?: string;
} {
    const positions = Object.keys(row.cells_by_position).map(Number);
    const required = Array.from({ length: 17 }, (_, i) => i + 1);
    const missing = required.filter(p => !positions.includes(p));

    if (missing.length > 0) {
        return {
            valid: false,
            missing,
            error: `Positions manquantes: ${missing.join(', ')}`
        };
    }

    return { valid: true, missing: [] };
}

/**
 * VALIDATION 2: Vérifie que les headers matchent les positions attendues
 */
function validateHeadersAtPositions(row: RowWithCoordinates): {
    valid: boolean;
    errors: Array<{ position: number; expected: string[]; got: string }>;
} {
    const errors: Array<{ position: number; expected: string[]; got: string }> = [];

    for (const [posStr, cell] of Object.entries(row.cells_by_position)) {
        const position = Number(posStr);
        const expectedHeaders = EXPECTED_HEADERS[position];

        if (!expectedHeaders) {
            continue; // Position non définie, skip
        }

        // Normaliser le header détecté
        const normalizedDetected = cell.header
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

        // Vérifier si le header match une des variations attendues
        const matches = expectedHeaders.some(expected =>
            normalizedDetected.includes(expected.toLowerCase()) ||
            expected.toLowerCase().includes(normalizedDetected)
        );

        if (!matches) {
            errors.push({
                position,
                expected: expectedHeaders,
                got: cell.header
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * VALIDATION 3: Vérifie les types de données attendus par position
 */
function validateDataTypes(row: RowWithCoordinates): {
    valid: boolean;
    errors: Array<{ position: number; field: string; expected: string; got: any }>;
} {
    const errors: Array<{ position: number; field: string; expected: string; got: any }> = [];

    // Position 1: Tournée (format TCT####)
    const tournee = row.cells_by_position["1"]?.value;
    if (tournee && !/^TCT\d{4}$/.test(tournee)) {
        errors.push({
            position: 1,
            field: 'tournee',
            expected: 'Format TCT#### (ex: TCT0046)',
            got: tournee
        });
    }

    // Position 6: Employé (4 chiffres)
    const employe = row.cells_by_position["6"]?.value;
    if (employe && employe !== '' && !/^\d{4}$/.test(employe)) {
        errors.push({
            position: 6,
            field: 'id_employe',
            expected: '4 chiffres (ex: 0450)',
            got: employe
        });
    }

    // Position 8: Employé confirm (4 chiffres)
    const employeConfirm = row.cells_by_position["8"]?.value;
    if (employeConfirm && employeConfirm !== '' && !/^\d{4}$/.test(employeConfirm)) {
        errors.push({
            position: 8,
            field: 'id_employe_confirm',
            expected: '4 chiffres (ex: 0450)',
            got: employeConfirm
        });
    }

    // Position 9: Véhicule (3 chiffres)
    const vehicule = row.cells_by_position["9"]?.value;
    if (vehicule && vehicule !== '' && !/^\d{3}$/.test(vehicule)) {
        errors.push({
            position: 9,
            field: 'vehicule',
            expected: '3 chiffres (ex: 232)',
            got: vehicule
        });
    }

    // Position 3 et 4: Horaires (format HH:MM)
    const debut = row.cells_by_position["3"]?.value;
    if (debut && debut !== '' && !/^\d{1,2}:\d{2}$/.test(debut)) {
        errors.push({
            position: 3,
            field: 'debut_tournee',
            expected: 'Format HH:MM (ex: 9:18)',
            got: debut
        });
    }

    const fin = row.cells_by_position["4"]?.value;
    if (fin && fin !== '' && !/^\d{1,2}:\d{2}$/.test(fin)) {
        errors.push({
            position: 4,
            field: 'fin_tournee',
            expected: 'Format HH:MM (ex: 9:54)',
            got: fin
        });
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * VALIDATION COMPLÈTE d'une ligne avant injection SQL
 */
export function validateRowBeforeSQL(row: RowWithCoordinates): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    mappedData?: Record<string, any>;
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation 1: Toutes les positions présentes
    const positionCheck = validateAllPositionsPresent(row);
    if (!positionCheck.valid) {
        errors.push(positionCheck.error!);
        console.error('❌ POSITIONS MANQUANTES:', positionCheck.missing);
    }

    // Validation 2: Headers aux bonnes positions
    const headerCheck = validateHeadersAtPositions(row);
    if (!headerCheck.valid) {
        headerCheck.errors.forEach(err => {
            errors.push(
                `Position ${err.position}: attendu ${err.expected.join('/')}, reçu "${err.got}"`
            );
        });
        console.error('❌ HEADERS INCORRECTS:', headerCheck.errors);
    }

    // Validation 3: Types de données
    const typeCheck = validateDataTypes(row);
    if (!typeCheck.valid) {
        typeCheck.errors.forEach(err => {
            warnings.push(
                `Position ${err.position} (${err.field}): attendu ${err.expected}, reçu "${err.got}"`
            );
        });
        console.warn('⚠️ TYPES DE DONNÉES SUSPECTS:', typeCheck.errors);
    }

    // Si erreurs critiques, stop
    if (errors.length > 0) {
        return { valid: false, errors, warnings };
    }

    // Mapper les données aux colonnes SQL
    const mappedData: Record<string, any> = {};
    for (const [posStr, cell] of Object.entries(row.cells_by_position)) {
        const position = Number(posStr);
        const sqlColumn = POSITION_TO_SQL_COLUMN[position];

        if (sqlColumn) {
            mappedData[sqlColumn] = cell.value === '' ? null : cell.value;
        }
    }

    return {
        valid: true,
        errors: [],
        warnings,
        mappedData
    };
}

/**
 * LOG DÉTAILLÉ pour debugging
 */
export function logCoordinateMapping(row: RowWithCoordinates): void {
    console.log('\n=== VALIDATION COORDONNÉES ===');
    console.log(`Ligne ${row.row_number} (y=${row.y_position || 'N/A'})`);
    console.log('\n| Pos | Header Détecté | Valeur | Colonne SQL |');
    console.log('|-----|----------------|--------|-------------|');

    for (let i = 1; i <= 17; i++) {
        const cell = row.cells_by_position[i.toString()];
        const sqlCol = POSITION_TO_SQL_COLUMN[i];

        if (cell) {
            const value = cell.value === '' ? '(vide)' : cell.value;
            console.log(`| ${i.toString().padStart(2)} | ${cell.header.padEnd(15)} | ${value} | ${sqlCol} |`);
        } else {
            console.log(`| ${i.toString().padStart(2)} | ❌ MANQUANT | - | ${sqlCol} |`);
        }
    }

    console.log('==============================\n');
}

/**
 * FONCTION PRINCIPALE: Convertir réponse IA → SQL
 */
export function convertAIResponseToSQL(aiResponse: {
    phase: string;
    rows: RowWithCoordinates[];
}): {
    success: boolean;
    validRows: Array<Record<string, any>>;
    errors: Array<{ row: number; errors: string[] }>;
} {
    const validRows: Array<Record<string, any>> = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    if (!aiResponse || !aiResponse.rows || !Array.isArray(aiResponse.rows)) {
        return { success: false, validRows: [], errors: [{ row: 0, errors: ["Format de réponse IA invalide (rows manquant)"] }] };
    }

    for (const row of aiResponse.rows) {
        // Log pour debugging
        logCoordinateMapping(row);

        // Validation complète
        const validation = validateRowBeforeSQL(row);

        if (validation.valid && validation.mappedData) {
            validRows.push(validation.mappedData);
            console.log(`✅ Ligne ${row.row_number} validée et mappée`);

            if (validation.warnings.length > 0) {
                console.warn(`⚠️ Warnings pour ligne ${row.row_number}:`, validation.warnings);
            }
        } else {
            errors.push({
                row: row.row_number,
                errors: validation.errors
            });
            console.error(`❌ Ligne ${row.row_number} REJETÉE:`, validation.errors);
        }
    }

    return {
        success: errors.length === 0,
        validRows,
        errors
    };
}
