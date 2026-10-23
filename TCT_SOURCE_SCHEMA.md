# Modèle réel TCT — 14 colonnes

Le modèle fourni est une capture « Affectations des tournées », horaire `20261023`.
L'ancien schéma de 15 colonnes ne correspondait pas à ce document. Il n'y a qu'une
colonne Employé : aucune colonne Employé confirmé, Autoris ou Retour sur ce modèle.

| Position | En-tête canonique | Champ base | Stockage |
|---|---|---|---|
| 1 | Tournée | tournee | Texte |
| 2 | Nom | nom | Texte |
| 3 | Déb tour | deb_tour | Texte source de l'heure |
| 4 | Fin tour | fin_tour | Texte source de l'heure |
| 5 | Classe véh | cl_veh | Texte |
| 6 | Employé | employe | Texte, zéros initiaux conservés |
| 7 | Nom de l'employé | nom_employe | Texte |
| 8 | Véhicule | vehicule | Texte |
| 9 | Cl véh aff | cl_veh_aff | Texte |
| 10 | Stationnement | stationnement | Texte, vide autorisé |
| 11 | Approuvé | approuve | État source reconnu, vide si illisible |
| 12 | Terr début | territoire_debut | Texte, conserve notamment 104-1 |
| 13 | Adresse de début | adresse_debut | Texte source |
| 14 | Adresse de fin | adresse_fin | Texte source |

Métadonnées du document : date de l'horaire (`2026-10-23`), tournées attribuées (169),
tournées simultanées (25), heure de pointe (`8:22`), tournées en retard (0).
Les compteurs sont des résumés de l'application source, pas le nombre de lignes
visibles de la capture. La date horaire est différente de la date du téléversement.
Le fuseau métier est `America/Toronto` (Terrebonne, Québec).

## Règles d'extraction

1. Lire exactement 14 cellules par ligne; conserver toutes les cellules vides.
2. Ne pas dédoubler l'ID employé ni insérer de colonnes absentes.
3. Ne pas confondre la zone « Terr début » avec « Stationnement ».
4. Conserver les zéros initiaux des identifiants.
5. Adresse coupée par `...` ou `…` : conserver le texte visible et les points;
   ne pas inventer la fin ni le code postal.
6. Case Approuvé cochée : `Oui`; case vide clairement reconnue : `Non`;
   case illisible : chaîne vide. Ne pas interpréter une cellule vide comme Oui.
7. Un fichier contenant plusieurs dates horaires doit être traité en documents séparés.
8. Une capture recadrée n'autorise aucune reconstitution de lignes hors écran.

## Contrat du moteur n8n

Retourner un objet `headers`, `rows` et, si lisibles, les `metadata` ci-dessous :

```json
{
  "headers": ["Tournée","Nom","Déb tour","Fin tour","Classe véh","Employé","Nom de l'employé","Véhicule","Cl véh aff","Stationnement","Approuvé","Terr début","Adresse de début","Adresse de fin"],
  "rows": [],
  "metadata": {
    "schedule_date": "2026-10-23",
    "tournees_attribuees": 169,
    "tournees_simultanees": 25,
    "heure_de_pointe": "8:22",
    "tournees_en_retard": 0
  }
}
```

`rows` doit contenir uniquement les lignes effectivement lues, en chaînes de caractères.
Les métadonnées illisibles sont omises. La base conserve la valeur source et ne
complète pas automatiquement les informations manquantes.

L'API transmet aussi `extraction_instructions` au webhook. Le workflow n8n doit utiliser
ce champ comme consigne du moteur; il ne faut pas conserver un ancien prompt à 15 colonnes.
