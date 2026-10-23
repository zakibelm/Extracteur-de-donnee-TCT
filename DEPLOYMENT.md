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
La clé de l'interface reste uniquement en mémoire pour l'onglet et est effacée à la
déconnexion ou au rechargement. Aucun moteur non configuré ne simule une extraction.
Les réponses et erreurs du moteur sont validées et affichées à l'utilisateur.
