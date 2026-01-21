# Instructions pour importer et configurer le workflow n8n

## Étape 1 : Importer le workflow

1. Ouvrez n8n : https://n8n.srv679767.hstgr.cloud
2. Cliquez sur **"+"** (Nouveau workflow) en haut à droite
3. Cliquez sur les **3 points** (menu) → **"Import from File"**
4. Sélectionnez le fichier : `IMPORT-THIS-tct-save-extraction-claude.json`
5. Le workflow sera importé avec 6 nodes

## Étape 2 : Comprendre le workflow

Le workflow actuel utilise des **SIMULATIONS** (Code nodes) au lieu de vraies insertions PostgreSQL :

```
Webhook → Parse Data → [SIMULATE Insert Document] → [SIMULATE Insert Tournées] → [SIMULATE Log History] → Response
```

### Nodes actuels (SIMULATION) :
- ✅ **Webhook - Receive Extraction** : Reçoit les données de l'app
- ✅ **Parse and Validate Data** : Valide les données reçues
- ⚠️ **Simulate Insert Document** : SIMULATION (à remplacer par PostgreSQL)
- ⚠️ **Simulate Insert Tournees** : SIMULATION (à remplacer par PostgreSQL)
- ⚠️ **Log to History** : SIMULATION (à remplacer par PostgreSQL)
- ✅ **Webhook Response - Success** : Retourne le résultat à l'app

## Étape 3 : Tester le workflow EN SIMULATION

1. **Activez le workflow** en cliquant sur le toggle en haut à droite
2. Le webhook sera disponible à : `https://n8n.srv679767.hstgr.cloud/webhook/tct-upload-document`
3. **Testez depuis l'application** :
   - Uploadez un document TCT
   - Extrayez les données
   - Cliquez sur "Générer le Document Final"
   - Vérifiez la console : `[TCT] Sauvegarde n8n réussie: <document_id>`
4. **Vérifiez les logs n8n** :
   - Allez dans "Executions" (historique)
   - Regardez la dernière exécution
   - Les données devraient être visibles dans chaque node

## Étape 4 : Remplacer les SIMULATIONS par PostgreSQL (OPTIONNEL)

⚠️ **IMPORTANT** : Le workflow fonctionne en mode SIMULATION pour l'instant.
Pour sauvegarder réellement dans PostgreSQL, vous devez :

### A. Créer les tables PostgreSQL d'abord

Exécutez le script SQL dans votre base Neon :
```bash
psql -h <your-neon-host>.neon.tech -U <user> -d <database> -f n8n-workflows/create-tables.sql
```

### B. Configurer les credentials PostgreSQL dans n8n

1. Dans n8n, allez dans **Settings** → **Credentials**
2. Cliquez sur **"Add Credential"**
3. Cherchez **"Postgres"**
4. Remplissez avec vos infos Neon :
   - Host: `<your-project>.neon.tech`
   - Database: votre nom de DB
   - User: votre utilisateur
   - Password: votre mot de passe
   - Port: `5432`
   - SSL: `allow` ou `require`
5. Testez la connexion
6. Sauvegardez avec le nom : `Neon PostgreSQL TCT`

### C. Remplacer les nodes Code par PostgreSQL

#### 1. Remplacer "Simulate Insert Document"

1. Supprimez le node **"Simulate Insert Document"**
2. Ajoutez un node **"Postgres"** à la place
3. Configurez :
   - **Operation** : `Insert`
   - **Schema** : `public`
   - **Table** : `tct_documents`
   - **Columns** : Mode = `Map Each Column`
     ```
     filename → {{ $json.filename }}
     file_url → {{ $json.file_url }}
     upload_date → {{ $json.upload_date }}
     status → {{ $json.status }}
     user_id → {{ $json.user_id }}
     extracted_count → {{ $json.extracted_count }}
     ```
   - **Options** → `Return Fields` : Activez et sélectionnez `id`

#### 2. Remplacer "Simulate Insert Tournees"

1. Supprimez le node **"Simulate Insert Tournees"**
2. Ajoutez un node **"Code"** pour préparer les tournées :
   ```javascript
   const documentId = $('Postgres').item.json.id;  // ID du document inséré
   const tournees = $input.item.json.tournees;

   return tournees.map(t => ({
     json: {
       document_id: documentId,
       tournee: t.tournee || '',
       nom: t.nom || '',
       deb_tour: t.deb_tour || '',
       fin_tour: t.fin_tour || '',
       cl_veh: t.cl_veh || '',
       employe: t.employe || '',
       nom_employe: t.nom_employe || '',
       employe_confirm: t.employe_confirm || '',
       vehicule: t.vehicule || '',
       cl_veh_aff: t.cl_veh_aff || '',
       autoris: t.autoris || '',
       approuve: t.approuve || '',
       retour: t.retour || '',
       adresse_debut: t.adresse_debut || '',
       adresse_fin: t.adresse_fin || ''
     }
   }));
   ```
3. Ajoutez un node **"Postgres"** après le Code :
   - **Operation** : `Insert`
   - **Schema** : `public`
   - **Table** : `tct_tournees`
   - **Columns** : Mapping automatique des champs

#### 3. Remplacer "Log to History"

1. Supprimez le node **"Log to History"**
2. Ajoutez un node **"Postgres"** :
   - **Operation** : `Insert`
   - **Schema** : `public`
   - **Table** : `tct_history`
   - **Columns** :
     ```
     document_id → {{ $('Postgres').item.json.id }}
     action → extraction_saved
     status → success
     message → {{ 'Document ' + $json.filename + ' traité avec ' + $json.tournees.length + ' tournées' }}
     execution_time_ms → {{ Date.now() - new Date($json.timestamp).getTime() }}
     ```

## Étape 5 : Activer et tester

1. **Sauvegardez** le workflow modifié (Ctrl+S)
2. **Activez** le workflow
3. **Testez** depuis l'application TCT
4. **Vérifiez PostgreSQL** :
   ```sql
   SELECT * FROM tct_documents ORDER BY id DESC LIMIT 1;
   SELECT * FROM tct_tournees WHERE document_id = (SELECT MAX(id) FROM tct_documents);
   SELECT * FROM tct_history ORDER BY id DESC LIMIT 5;
   ```

## Mode SIMULATION vs Mode PRODUCTION

### Mode SIMULATION (actuel) ✅
- Workflow fonctionne immédiatement
- Retourne des IDs fictifs
- Pas besoin de PostgreSQL configuré
- Utile pour tester l'intégration app ↔ n8n

### Mode PRODUCTION (avec PostgreSQL) 🎯
- Sauvegarde réelle dans la base de données
- IDs vrais et cohérents
- Nécessite configuration PostgreSQL
- Données persistantes et consultables

## Résumé

1. ✅ Importez `IMPORT-THIS-tct-save-extraction-claude.json`
2. ✅ Activez le workflow
3. ✅ Testez en mode SIMULATION (fonctionne immédiatement)
4. ⚠️ Optionnel : Configurez PostgreSQL pour mode PRODUCTION

Le workflow en mode SIMULATION permet de **vérifier que l'intégration fonctionne** entre votre app et n8n avant de configurer PostgreSQL.
