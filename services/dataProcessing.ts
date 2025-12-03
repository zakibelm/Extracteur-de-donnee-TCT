
import { Status, ExtractedData, TableData } from '../types';

/**
 * Construit un tableau unifié à partir de la liste des données extraites.
 * Gère la déduplication et l'enrichissement des colonnes (Changement, Changement par).
 */
export const buildUnifiedTable = (dataList: ExtractedData[]): TableData | null => {
    const successfulExtractions = dataList
        .filter(d => d.status === Status.Success && d.content && d.content.rows.length > 0 && d.content.headers[0] !== 'Erreur');
    
    if (successfulExtractions.length === 0) {
        return null;
    }

    // Clone des en-têtes pour ne pas muter l'objet original
    const masterHeaders = [...successfulExtractions[0].content!.headers];
    
    // Recherche de l'index de la colonne "Véhicule"
    const vehiculeIndex = masterHeaders.indexOf("Véhicule");
    
    // Si la colonne existe, on ajoute "Changement" et "Changement par" juste après
    if (vehiculeIndex !== -1) {
        if (!masterHeaders.includes("Changement")) {
            masterHeaders.splice(vehiculeIndex + 1, 0, "Changement");
        }
        if (!masterHeaders.includes("Changement par")) {
            masterHeaders.splice(vehiculeIndex + 2, 0, "Changement par");
        }
    }
    
    // Performance: Use a Set to deduplicate rows based on stringified content
    const uniqueRowsSet = new Set<string>();
    const rows: string[][] = [];

    successfulExtractions.forEach(d => {
        d.content!.rows.forEach(row => {
            // Clone de la ligne
            const newRow = [...row];
            if (vehiculeIndex !== -1) {
                // Valeur par défaut = Numéro du véhicule
                const vehiculeVal = newRow[vehiculeIndex] || "";
                // Insertion à la position adéquate
                newRow.splice(vehiculeIndex + 1, 0, vehiculeVal, "");
            }
            
            // Deduplication Key
            const rowKey = JSON.stringify(newRow);
            if (!uniqueRowsSet.has(rowKey)) {
                uniqueRowsSet.add(rowKey);
                rows.push(newRow);
            }
        });
    });

    return {
        headers: masterHeaders,
        rows: rows,
    };
};
