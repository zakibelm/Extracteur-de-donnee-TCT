# Formats source TCT
Deux dispositions distinctes sont prises en charge.

## dispatch_14
Tournée, Nom, Déb tour, Fin tour, Classe véh, Employé, Nom de l'employé,
Véhicule, Cl véh aff, Stationnement, Approuvé, Terr début, Adresse de début, Adresse de fin.

## dispatch_16
Tournée, Nom, Déb tour, Fin tour, Cl véh, Employé, Nom de l'employé,
Employé (2), Véhicule, Cl véh aff, Autoris, Approuvé, Retour, Statut FDR,
Adresse de début, Adresse de fin.

Le deuxième en-tête est également « Employé » dans la source. L'interface le
distingue sous « Employé (2) » et le stockage le nomme employe_affecte.
Il ne doit jamais être confondu avec le véhicule situé à sa droite.
Autoris, Retour et Statut FDR ne sont pas Stationnement et Terr début.

## Contrat v2
Le modèle retourne source_layout, rows sous forme d'objets à champs nommés et metadata.
Le serveur reconstruit l'ordre du format détecté. Les 18 champs possibles de l'union
des formats sont déclarés dans le schéma JSON ; les champs absents sont des chaînes vides.
Les colonnes propres au format 16 sont conservées dans la base et lors de la relecture.
Les zéros initiaux, cellules vides, adresses et noms tronqués restent préservés.
Approuvé et Retour sont Oui/Non si lisibles, sinon vides.
Ne pas confondre le compteur de tournées attribuées avec les lignes réellement visibles.

Horaire est recopié en metadata.schedule_code : huit chiffres YYYYMMDD.
20261018 signifie 2026-10-18. La conversion est validée dans le code et dans SQL.
Les heures restent exactes : 8:03 n'est pas 8:30.

## Migration et historique
Appliquer 20261024200035_support_tct_dispatch_16.sql avant le déploiement applicatif.
Les colonnes sont ajoutées sans suppression des données existantes.
Les nouveaux documents conservent source_layout et schema_version=2.
Les anciens résultats identifiés comme décalés restent conservés et signalés
review_required ; ils doivent être réanalysés depuis l'image, sans réinterprétation
automatique de cellules perdues. Un enregistrement n'est pas une certification OCR.

## Filtres
Identifiants exacts : 43 ne sélectionne pas le véhicule 430.
Le préfixe TCT et les zéros initiaux sont facultatifs dans la recherche d'une tournée.
Plusieurs identifiants séparés par +, virgule, espace ou point-virgule forment un OU.
Les filtres tournée et véhicule se combinent en ET et se réinitialisent au changement de document.
