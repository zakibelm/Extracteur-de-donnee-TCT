# Déploiement 1.1.0

## 1. Base Supabase existante

Sauvegarder la base puis exécuter dans le SQL Editor :
`supabase/migrations/20261023_stabilize_extractions.sql`.
Cette migration additive ne supprime pas les documents. Elle suppose les tables
existantes `users`, `tct_documents`, `tct_tournees`, `tct_history` du schéma Supabase.
**Ne pas relancer `migration-complete.sql` sur une base existante : ce script historique supprime les tables.**

La migration ajoute la sauvegarde transactionnelle, une clé de nouvelle tentative,
une protection des privilèges et un trigger d'inscription qui crée uniquement des conducteurs.
Les politiques RLS existantes continuent de s'appliquer aux documents.

## 2. Comptes de répartition

Attribuer `app_metadata.role = "admin"` aux comptes de répartition approuvés via
Supabase Admin API ou les outils administrateur Supabase. Conserver les autres
métadonnées applicatives lors de la mise à jour. Le rôle dans `user_metadata` et le
choix d'un utilisateur à l'inscription ne donnent plus aucun accès administrateur.
Les comptes existants qui utilisaient seulement `user_metadata.role` doivent être
revus et les comptes autorisés provisionnés avant le déploiement du frontend.
Se déconnecter/reconnecter après changement de rôle pour renouveler les JWT SQL.

## 3. Serveur et n8n

Configurer dans Vercel les variables de `.env.example` (sans PORT en production).
Utiliser le même projet Supabase pour le navigateur et le serveur.
`N8N_EXTRACT_WEBHOOK` doit être une URL HTTPS du workflow d'extraction réel.

Sur le webhook n8n, activer **Header Auth** : nom `X-Webhook-Secret`, valeur identique
à `N8N_WEBHOOK_SECRET`. Ne pas laisser une deuxième URL publique donnant accès au
même workflow sans authentification. Le client appelle uniquement `/api/n8n`.
L'URL et le secret restent côté serveur; le navigateur envoie son JWT Supabase.
Les anciens webhooks publics encore actifs doivent être désactivés ou protégés
indépendamment : un changement Git ne peut pas les sécuriser sur le serveur n8n.

Le workflow doit recevoir `{image, mimeType, section, user_id, user_dome, timestamp}`
et retourner `{headers: string[], rows: string[][]}`. Pour TCT, les 14 en-têtes doivent
correspondre exactement à `TCT_HEADERS` dans `src/utils/table.ts`. Il ne doit pas
sauvegarder lui-même une deuxième copie des tournées : l'application utilise la RPC.
Prévoir un budget de temps suffisant pour le workflow et la fonction Vercel selon
le plan d'hébergement. Le client attend au maximum 120 s, le serveur n8n 110 s.

## 4. Secrets précédemment suivis par Git

Le fichier `.env` est retiré du suivi. Une `DATABASE_URL` renseignée figurait dans
l'historique du dépôt. Révoquer/remplacer les identifiants associés s'ils sont encore
valides; retirer le fichier d'un nouveau commit ne les retire pas de l'historique.
Ne jamais mettre de clé `service_role` dans les variables `VITE_*`.

## 5. Vérification avant publication

- `npm ci` puis `npm run check`.
- Connexion conducteur : aucun accès à l'extraction ni auto-attribution admin.
- Connexion répartition : extraire un PDF et comparer véhicule, employé et adresses à la source.
- Sauvegarder puis réessayer : un document et une seule copie de chaque tournée.
- Couper le réseau : l'interface doit signaler l'échec, sans annoncer une sauvegarde réussie.
- Appel direct au webhook sans son secret : refus.
- Requête API sans JWT : HTTP 401; avec un compte conducteur : HTTP 403.

Les services distants et la précision OCR doivent être validés avec les vrais
comptes/documents; les tests automatisés utilisent uniquement des données synthétiques.

## Base dédiée et schéma du modèle réel

Projet : `csypcxkpipafxrjaborn` (`extracteur-tct`, Canada).
Nouvelle base vide : exécuter `supabase/bootstrap.sql`, `supabase/security.sql`,
puis `supabase/migrations/20261023_tct_source_14_columns.sql`.
Base existante déjà stabilisée v1 : appliquer seulement la migration additive
`20261023_tct_source_14_columns.sql`. Elle conserve les colonnes et données historiques.
La configuration publique par défaut vise la nouvelle base; retirer ou actualiser
les anciennes variables Vercel Supabase si elles visent un projet précédent.
Aucun mot de passe utilisateur ne doit être ajouté à Git ou aux variables VITE_*.

Contrôle sécurité Supabase : activer la protection contre les mots de passe compromis
si disponible sur le plan. Voir https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Import et analyse des documents

Les fichiers Android dont le fournisseur ne renseigne pas le type MIME sont reconnus
par leur extension PNG/JPG/WEBP/PDF, puis normalisés. Les fichiers vides, trop volumineux
ou non pris en charge affichent une erreur. Une sélection valide reste visible;
l'utilisateur clique ensuite sur Lancer TCT/Olymel pour analyser.

Le service utilise le webhook n8n lorsqu'il est configuré. À défaut, il peut appeler
OpenRouter avec OPENROUTER_API_KEY côté serveur, ou avec la clé fournie dans Paramètres.
La saisie de la clé active l’onglet courant. Une sauvegarde explicite mémorise la clé
sur cet appareil pour le compte connecté ; elle est restaurée après rechargement. Aucun moteur non configuré ne simule une extraction.
Les réponses et erreurs du moteur sont validées et affichées à l'utilisateur.


## Durcissement des accès — 24 octobre 2026

Sur une base TCT existante, appliquer `supabase/fix-admin-escalation.sql`.
Le script conserve les admins dont `auth.users.raw_app_meta_data.role` vaut
`admin`, aligne uniquement les profils incohérents et ignore les métadonnées
modifiables pour les privilèges. Aucun document ni compte n’est supprimé.
Les visiteurs n’ont aucun accès aux tables TCT ; les comptes connectés n’ont
ni TRUNCATE, ni REFERENCES, ni TRIGGER. Les vues restent en lecture seule.

Les scripts historiques Neon n’embarquent plus de connexion ni de mot de passe.
Ils nécessitent une DATABASE_URL explicite et ne font pas partie du parcours
Supabase de production. Les anciens scripts de promotion par numéro sont désactivés.
Une ancienne clé publiée reste compromise même après retrait du code : la révoquer
chez Neon. Ne pas remplacer les paramètres Supabase par cette connexion historique.
Ne pas purger l’historique par force avant révocation et coordination des clones.


## Modèles et préparation des scans

La sélection applicative est limitée à GPT-4.1 Mini (défaut) et GPT-4.1.
Le catalogue OpenRouter vérifie leur présence, l’entrée image et les sorties structurées.
Les sélections historiques hors liste sont migrées vers le défaut ; aucun modèle
preview, routeur gratuit ou générateur d’images n’est proposé.
Les réponses utilisent un schéma JSON strict (14 cellules par ligne TCT, 5 Olymel).
Les images dépassant le budget de requête sont converties côté navigateur en JPEG,
avec un côté maximal de 3200 pixels et une limite base64 de 3,4 millions de caractères.
Un test réussi active immédiatement la clé en mémoire et le modèle sélectionné.
La clé explicitement testée a priorité sur les configurations serveur ou webhook.
La disponibilité du catalogue ne prouve pas les crédits ou permissions d’une clé :
le test vision dans Paramètres reste nécessaire pour vérifier le compte OpenRouter.


## Enregistrement et ergonomie des résultats TCT

Une extraction TCT entièrement réussie est consolidée, puis enregistrée automatiquement
par le RPC transactionnel existant. Le statut enregistré n’apparaît qu’après un accusé
de réception valide (document et nombre de lignes). En cas d’échec, le tableau reste
affiché et une nouvelle tentative réutilise le même request_id pour éviter les doublons.
Les corrections manuelles sont signalées comme non enregistrées et peuvent être
conservées dans une nouvelle version, sans écraser le document précédent.

La section Documents enregistrés lit les 50 derniers documents du compte connecté.
Le bouton Ouvrir recharge les lignes depuis Supabase, avec pagination au-delà de
1000 lignes et contrôle du nombre total. Les règles RLS existantes restent actives.
Les images originales ne sont pas archivées ; les tableaux et leurs métadonnées le sont.
Les résultats Olymel restent distincts de cet archivage TCT.

L’échelle CSS 0,85 est supprimée. Le panneau d’import se replie sur petit écran,
le tableau garde une zone de défilement horizontale et l’état de sauvegarde reste visible.
Validation SQL réelle : écriture, relecture sous le rôle authenticated et nouvelle
 tentative idempotente sur données synthétiques dans une transaction annulée.

## Formats TCT v2
Appliquer 20261024200035_support_tct_dispatch_16.sql avant cette version.
Elle ajoute employe_affecte, autoris, retour et statut_fdr sans retirer les données
du format 14. Le RPC reste compatible avec les anciens clients.
Les nouvelles extractions conservent source_layout et schema_version=2.
Le moteur retourne des champs nommés ; le serveur reconstruit les colonnes.
Le code horaire brut YYYYMMDD est converti dans le code et dans SQL.
Voir TCT_SOURCE_SCHEMA.md pour les deux contrats et les règles des filtres.
Les résultats historiques identifiés comme décalés restent conservés et sont signalés
review_required ; ils doivent être réanalysés.

Validation : régressions sur la seconde colonne employé, le véhicule, la classe,
la date octobre, les filtres exacts et la remise à zéro au changement de document.
Test SQL réel sous authenticated : écriture et relecture du format 16, puis annulation
de la transaction synthétique sans données de test persistantes.

## Mémorisation explicite des clés OpenRouter
Le bouton Sauvegarder écrit une clé par UUID utilisateur dans localStorage.
La saisie et le bouton Tester activent seulement la clé en mémoire.
À la déconnexion, la mémoire active est vidée. La clé sauvegardée reste disponible
pour une prochaine connexion du même compte sur le même profil de navigateur.
Le bouton Supprimer la clé mémorisée efface le stockage de ce compte et la mémoire.
Un échec ou un refus de stockage produit une erreur visible, sans confirmation trompeuse.

La clé est conservée en clair dans le stockage local du navigateur. Le code de
l’origine et les utilisateurs de ce profil de navigateur peuvent y accéder :
utiliser un profil personnel. Cette mémorisation ne synchronise pas les appareils
et reste soumise à l’effacement des données du navigateur et au mode privé.
Aucune valeur de clé n’est inscrite dans le dépôt ni transmise à une nouvelle destination.
