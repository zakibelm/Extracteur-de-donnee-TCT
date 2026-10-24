# ADT — Extracteur de données TCT / Olymel

Application React/TypeScript pour extraire des tableaux depuis des images/PDF,
consulter les résultats et sauvegarder les extractions TCT dans Supabase.
Version 1.1.0 : stabilisation de l'alignement, de l'authentification et des sauvegardes.

## Développement et vérification

Node.js **22.12 ou supérieur**.

```bash
npm ci
cp .env.example .env.local
# Renseigner .env.local avec le projet Supabase et le webhook n8n.
npm run api:dev
# Autre terminal :
npm run dev
```

Interface : http://127.0.0.1:3005. API locale : port 3002.
L'API locale utilise les mêmes handlers que Vercel et ne simule aucune sauvegarde.

```bash
npm run check
```

Ce contrôle exécute TypeScript, les tests et le build de production. Les tests SQL
utilisent PostgreSQL embarqué (PGlite) : alignement des 14 champs, droits, absence de
doublons lors d'une nouvelle tentative et annulation complète en cas d'erreur.
Les tests ne font aucun appel aux services de production.

## Architecture active

- `index.html` → `src/index.tsx` → `src/App.tsx` : unique entrée compilée.
- `src/services/authService.ts` : Supabase Auth; rôle issu de `app_metadata` protégé.
- `src/services/n8n.ts` → `api/n8n.ts` : extraction autorisée côté serveur.
- `src/services/supabaseService.ts` : sauvegarde via la transaction SQL `save_tct_extraction`.
- `src/utils/table.ts` : rejet des tableaux mal alignés et des colonnes incompatibles.
- `server/` : contrôle d'accès et tests PostgreSQL.
- `api/auth`, `api/users`, `api/save-to-n8n` : anciens endpoints désactivés (HTTP 410).

Les anciennes copies racine `App.tsx`, `components/`, `services/` et `src/db/` sont
conservées comme références historiques; elles ne sont pas l'application active.
Les anciens guides Neon et n8n décrivent des étapes antérieures : ce README et le
guide `DEPLOYMENT.md` décrivent la version actuelle.

## Comportements de fiabilité

- Aucun ajout implicite de cellules lors de la consolidation.
- Les pages avec des en-têtes différents ou un nombre de cellules incorrect sont rejetées.
- Une extraction partielle ne peut pas être sauvegardée comme complète.
- PDF : maximum 50 pages; deux conversions/appels IA simultanés.
- Worker PDF distribué avec la version installée, sans CDN indépendant.
- Les erreurs de sauvegarde sont visibles; une nouvelle tentative réutilise la même clé.
- Documents, lignes et historique sont écrits dans une seule transaction.
- Les tableaux ne sont plus conservés dans un stockage navigateur partagé entre comptes.

## Limites et déploiement

Voir [DEPLOYMENT.md](DEPLOYMENT.md) **avant mise en production** : migration SQL,
attribution des rôles, variables Vercel, protection du webhook n8n et test réel.
L'exactitude OCR n'est pas mesurée par les tests du code. Un jeu de documents annotés
reste nécessaire avant d'annoncer un pourcentage de précision.

## Modèle TCT réel (14 colonnes)

Voir `TCT_SOURCE_SCHEMA.md` pour le mapping établi à partir du modèle fourni.
La base dédiée est `extracteur-tct` en région Canada. La configuration publique par
défaut se trouve dans `src/config/supabase.ts`; les variables d'environnement restent prioritaires.
Le compte demandé accepte `203` ou son courriel. Le mot de passe est vérifié par
Supabase Auth et n'est jamais inscrit dans le dépôt.

## Formats TCT actuels
Le format à 16 colonnes avec deux colonnes Employé, Autoris, Retour et Statut FDR
est distinct du format à 14 colonnes avec Stationnement et Terr début.
Appliquer les migrations successives, dont 20261024200035_support_tct_dispatch_16.sql.
La définition actuelle fait foi dans [TCT_SOURCE_SCHEMA.md](TCT_SOURCE_SCHEMA.md).
Les anciens résultats signalés « À réanalyser » doivent être repris depuis l'image originale.
