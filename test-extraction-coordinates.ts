// Test pour vérifier que l'IA extrait avec coordonnées (ligne + en-tête)

import { validateAndConvertAIResponse } from './services/cellByCellValidator';

/**
 * MOCK: Réponse IA idéale pour ligne TCT0027 de l'image tct3.jpeg
 * C'est ce que l'IA DEVRAIT retourner
 */
const EXPECTED_AI_RESPONSE = {
    "phase": "execute",
    "headers_detected": [
        "Tournée",
        "Nom",
        "Déb tour",
        "Fin tour",
        "Cl véh",
        "Employé",
        "Nom de l'employé",
        "Employé",
        "Véhicule",
        "Cl véh aff",
        "Autoris",
        "Approuvé",
        "Retour",
        "Adresse de début",
        "Adresse de fin"
    ],
    "total_headers": 15,
    "data": [
        {
            "row_number": 5,
            "cells": [
                { "column_header": "Tournée", "value": "TCT0027", "verified": true },
                { "column_header": "Nom", "value": "TAXI COOP TERREBONNE", "verified": true },
                { "column_header": "Déb tour", "value": "9:30", "verified": true },
                { "column_header": "Fin tour", "value": "9:47", "verified": true },
                { "column_header": "Cl véh", "value": "TAXI", "verified": true },
                { "column_header": "Employé", "value": "0450", "verified": true },
                { "column_header": "Nom de l'employé", "value": "Rezali, Karim", "verified": true },
                { "column_header": "Employé", "value": "0450", "verified": true },
                { "column_header": "Véhicule", "value": "232", "verified": true },
                { "column_header": "Cl véh aff", "value": "MINIVAN", "verified": true },
                { "column_header": "Autoris", "value": "", "verified": true },
                { "column_header": "Approuvé", "value": "✓", "verified": true },
                { "column_header": "Retour", "value": "", "verified": true },
                { "column_header": "Adresse de début", "value": "3365 du Moulin RUE Terrebonne J6X 4C1", "verified": true },
                { "column_header": "Adresse de fin", "value": "3099 de Mascouche BOUL Mascouche J7K 3B7", "verified": true }
            ]
        }
    ]
};

/**
 * TEST 1: Vérifier format de la réponse
 */
function test1_checkResponseFormat(response: any): boolean {
    console.log('\n=== TEST 1: Format de la Réponse ===');

    const checks = {
        'phase existe': response.phase === 'execute',
        'headers_detected existe': Array.isArray(response.headers_detected),
        'total_headers correct': response.total_headers === response.headers_detected.length,
        'data existe': Array.isArray(response.data),
        'data non vide': response.data.length > 0
    };

    for (const [test, passed] of Object.entries(checks)) {
        console.log(`${passed ? '✅' : '❌'} ${test}`);
    }

    return Object.values(checks).every(v => v);
}

/**
 * TEST 2: Vérifier que chaque ligne a le bon nombre de cellules
 */
function test2_checkCellCount(response: any): boolean {
    console.log('\n=== TEST 2: Nombre de Cellules ===');

    const expectedCount = response.headers_detected.length;
    let allValid = true;

    for (const row of response.data) {
        const cellCount = row.cells.length;
        const valid = cellCount === expectedCount;

        console.log(
            `${valid ? '✅' : '❌'} Ligne ${row.row_number}: ${cellCount} cellules ` +
            `(attendu: ${expectedCount})`
        );

        if (!valid) allValid = false;
    }

    return allValid;
}

/**
 * TEST 3: Vérifier coordonnées (ligne + en-tête)
 */
function test3_checkCoordinates(response: any): boolean {
    console.log('\n=== TEST 3: Coordonnées Ligne + En-tête ===');

    const row = response.data[0];
    let allValid = true;

    console.log(`\nLigne ${row.row_number}:`);
    console.log('| En-tête | Valeur | ✓ |');
    console.log('|---------|--------|---|');

    for (const cell of row.cells) {
        const hasHeader = cell.column_header && cell.column_header !== '';
        const hasValue = cell.value !== undefined;
        const valid = hasHeader && hasValue;

        console.log(
            `| ${cell.column_header.padEnd(20)} | ${String(cell.value).substring(0, 20).padEnd(20)} | ${valid ? '✅' : '❌'} |`
        );

        if (!valid) allValid = false;
    }

    return allValid;
}

/**
 * TEST 4: Vérifier valeurs critiques (pas de décalage)
 */
function test4_checkCriticalValues(response: any): boolean {
    console.log('\n=== TEST 4: Valeurs Critiques (Anti-Décalage) ===');

    const row = response.data[0];

    // Trouver les cellules par en-tête
    const findCell = (header: string) =>
        row.cells.find((c: any) =>
            c.column_header.toLowerCase().includes(header.toLowerCase())
        );

    const tests = [
        {
            name: 'Tournée',
            cell: findCell('tournée'),
            expectedFormat: /^TCT\d{4}$/,
            example: 'TCT0027'
        },
        {
            name: 'Véhicule',
            cell: findCell('véhicule'),
            expectedFormat: /^\d{3}$/,
            example: '232'
        },
        {
            name: 'Employé (1ère)',
            cell: row.cells.find((c: any) =>
                c.column_header.toLowerCase() === 'employé' ||
                c.column_header.toLowerCase() === 'employe'
            ),
            expectedFormat: /^\d{4}$/,
            example: '0450'
        },
        {
            name: 'Approuvé',
            cell: findCell('approuvé'),
            expectedValue: '✓',
            example: '✓'
        }
    ];

    let allValid = true;

    for (const test of tests) {
        if (!test.cell) {
            console.log(`❌ ${test.name}: En-tête non trouvé!`);
            allValid = false;
            continue;
        }

        let valid = false;

        if (test.expectedFormat) {
            valid = test.expectedFormat.test(test.cell.value);
        } else if (test.expectedValue) {
            valid = test.cell.value === test.expectedValue;
        }

        console.log(
            `${valid ? '✅' : '❌'} ${test.name}: ` +
            `valeur="${test.cell.value}" (attendu: ${test.example})`
        );

        if (!valid) allValid = false;
    }

    return allValid;
}

/**
 * TEST 5: Détecter décalage
 */
function test5_detectShift(response: any): boolean {
    console.log('\n=== TEST 5: Détection de Décalage ===');

    const row = response.data[0];

    // Ces valeurs NE DOIVENT PAS apparaître dans les mauvaises colonnes
    const vehiculeCell = row.cells.find((c: any) =>
        c.column_header.toLowerCase().includes('véhicule')
    );

    const employeCell = row.cells.find((c: any) =>
        c.column_header.toLowerCase() === 'employé' ||
        c.column_header.toLowerCase() === 'employe'
    );

    const approuveCell = row.cells.find((c: any) =>
        c.column_header.toLowerCase().includes('approuvé')
    );

    const shiftsDetected = [];

    // Vérifier si "TAXI" est dans colonne Employé (signe de décalage)
    if (employeCell && employeCell.value === 'TAXI') {
        shiftsDetected.push('Employé contient "TAXI" au lieu d\'un numéro');
    }

    // Vérifier si Véhicule contient un nom (signe de décalage)
    if (vehiculeCell && /[a-zA-Z]/.test(vehiculeCell.value)) {
        shiftsDetected.push(`Véhicule contient "${vehiculeCell.value}" au lieu d'un numéro`);
    }

    // Vérifier si Approuvé contient autre chose que ✓ ou vide
    if (approuveCell && approuveCell.value !== '✓' && approuveCell.value !== '') {
        shiftsDetected.push(`Approuvé contient "${approuveCell.value}" au lieu de ✓`);
    }

    if (shiftsDetected.length > 0) {
        console.log('❌ DÉCALAGE DÉTECTÉ:');
        shiftsDetected.forEach(shift => console.log(`   - ${shift}`));
        return false;
    } else {
        console.log('✅ Aucun décalage détecté');
        return true;
    }
}

/**
 * TEST 6: Mapper au SQL et vérifier
 */
function test6_mapToSQL(response: any): boolean {
    console.log('\n=== TEST 6: Mapping SQL ===');

    try {
        const validation = validateAndConvertAIResponse(response);

        if (!validation.success) {
            console.log('❌ Validation échouée:');
            validation.errors.forEach(err => {
                console.log(`   Ligne ${err.row}: ${err.errors.join(', ')}`);
            });
            return false;
        }

        console.log(`✅ ${validation.validRows.length} lignes validées`);

        // Afficher le mapping SQL
        const sqlRow = validation.validRows[0];
        console.log('\nMapping SQL:');
        console.log(JSON.stringify(sqlRow, null, 2));

        // Vérifier les champs critiques
        const criticalChecks = {
            'tournee existe': sqlRow.tournee !== undefined,
            'id_employe existe': sqlRow.id_employe !== undefined,
            'vehicule existe': sqlRow.vehicule !== undefined,
            'vehicule est nombre': /^\d{3}$/.test(sqlRow.vehicule),
            'id_employe est nombre': /^\d{4}$/.test(sqlRow.id_employe)
        };

        console.log('\nVérifications critiques:');
        for (const [check, passed] of Object.entries(criticalChecks)) {
            console.log(`${passed ? '✅' : '❌'} ${check}`);
        }

        return Object.values(criticalChecks).every(v => v);

    } catch (err) {
        console.log('❌ Erreur lors du mapping:', err);
        return false;
    }
}

/**
 * EXÉCUTER TOUS LES TESTS
 */
async function runAllTests() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║   TEST EXTRACTION AVEC COORDONNÉES LIGNE+ENTÊTE   ║');
    console.log('╚════════════════════════════════════════════════╝');

    const results = {
        'Format réponse': test1_checkResponseFormat(EXPECTED_AI_RESPONSE),
        'Nombre cellules': test2_checkCellCount(EXPECTED_AI_RESPONSE),
        'Coordonnées': test3_checkCoordinates(EXPECTED_AI_RESPONSE),
        'Valeurs critiques': test4_checkCriticalValues(EXPECTED_AI_RESPONSE),
        'Détection décalage': test5_detectShift(EXPECTED_AI_RESPONSE),
        'Mapping SQL': test6_mapToSQL(EXPECTED_AI_RESPONSE)
    };

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║                 RÉSUMÉ DES TESTS                   ║');
    console.log('╚════════════════════════════════════════════════╝');

    for (const [test, passed] of Object.entries(results)) {
        console.log(`${passed ? '✅' : '❌'} ${test}`);
    }

    const allPassed = Object.values(results).every(v => v);

    console.log('\n' + (allPassed ?
        '🎉 TOUS LES TESTS RÉUSSIS!' :
        '❌ CERTAINS TESTS ONT ÉCHOUÉ'
    ));

    return allPassed;
}

/**
 * TEST AVEC RÉPONSE IA RÉELLE
 */
export async function testRealAIResponse(aiResponseJSON: string) {
    console.log('\n=== TEST AVEC RÉPONSE IA RÉELLE ===\n');

    try {
        const response = JSON.parse(aiResponseJSON);

        console.log('1. Format de la réponse...');
        if (!test1_checkResponseFormat(response)) {
            console.log('❌ Format invalide, arrêt des tests');
            return false;
        }

        console.log('\n2. Nombre de cellules...');
        if (!test2_checkCellCount(response)) {
            console.log('⚠️ Problème de nombre de cellules détecté');
        }

        console.log('\n3. Coordonnées...');
        test3_checkCoordinates(response);

        console.log('\n4. Valeurs critiques...');
        test4_checkCriticalValues(response);

        console.log('\n5. Détection décalage...');
        const noShift = test5_detectShift(response);

        console.log('\n6. Mapping SQL...');
        const sqlValid = test6_mapToSQL(response);

        return noShift && sqlValid;

    } catch (err) {
        console.error('❌ Erreur parsing JSON:', err);
        return false;
    }
}

// Exporter pour utilisation
export { runAllTests, EXPECTED_AI_RESPONSE };

// Si exécuté directement
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}
