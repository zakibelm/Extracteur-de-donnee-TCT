import { TCT_HEADERS } from '../src/utils/table';

export const TCT_EXTRACTION_INSTRUCTIONS = `Extrais uniquement les lignes visibles du tableau TCT.
Ce modèle possède exactement 14 colonnes, dans cet ordre : ${JSON.stringify(TCT_HEADERS)}.
Conserve les cellules vides et les zéros initiaux. Ne crée aucune deuxième colonne Employé.
Stationnement et Terr début sont deux colonnes distinctes. Un territoire peut être 104-1.
Ne complète jamais une adresse coupée : conserve les ... ou … visibles.
Approuvé : Oui si la case est cochée, Non si elle est clairement décochée, vide si illisible.
Retourne headers et rows (tableau de tableaux de chaînes), plus metadata si les valeurs sont lisibles :
schedule_date (YYYY-MM-DD depuis Horaire), tournees_attribuees, tournees_simultanees,
heure_de_pointe, tournees_en_retard. Les compteurs ne sont pas le nombre de lignes visibles.
Ne reconstruis aucune ligne hors écran et ne mélange pas des dates horaires différentes.`;
