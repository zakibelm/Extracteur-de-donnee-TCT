# Intégration n8n - Sauvegarde des Extractions TCT

## Vue d'ensemble

L'application TCT sauvegarde maintenant automatiquement toutes les extractions réussies dans les **Data Tables n8n** via des webhooks. Les données sont stockées en double : localStorage (pour l'interface) + PostgreSQL via n8n (pour la persistance).

## Architecture

```
[Frontend App] → [API /api/save-to-n8n] → [n8n Webhook] → [PostgreSQL Data Tables]
     ↓                                                              ↓
[localStorage]                                           [tct_documents]
                                                         [tct_tournees]
                                                         [tct_history]
```

## Tables PostgreSQL

### 1. `tct_documents`
Stocke les métadonnées des documents uploadés.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | SERIAL | ID auto-incrémenté |
| `filename` | VARCHAR(255) | Nom du fichier original |
| `file_url` | TEXT | URL du fichier (optionnel) |
| `upload_date` | TIMESTAMP | Date d'upload |
| `status` | VARCHAR(20) | pending, processing, success, error |
| `user_id` | VARCHAR(50) | ID de l'utilisateur (numDome) |
| `extracted_count` | INTEGER | Nombre de tournées extraites |
| `created_at` | TIMESTAMP | Date de création |
| `updated_at` | TIMESTAMP | Date de mise à jour |

### 2. `tct_tournees`
Stocke les tournées extraites.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | SERIAL | ID auto-incrémenté |
| `document_id` | INTEGER | Référence vers tct_documents |
| `tournee` | VARCHAR(100) | Numéro de tournée |
| `nom` | VARCHAR(255) | Nom |
| `deb_tour` | VARCHAR(50) | Heure de début |
| `fin_tour` | VARCHAR(50) | Heure de fin |
| `cl_veh` | VARCHAR(50) | Classe véhicule |
| `employe` | VARCHAR(100) | ID employé |
| `nom_employe` | VARCHAR(255) | Nom de l'employé |
| `employe_confirm` | VARCHAR(100) | Confirmation employé |
| `vehicule` | VARCHAR(100) | Numéro véhicule |
| `cl_veh_aff` | VARCHAR(50) | Classe véhicule affecté |
| `autoris` | VARCHAR(50) | Autorisation |
| `approuve` | VARCHAR(50) | Approuvé (Oui/Non) |
| `retour` | VARCHAR(50) | Retour (Oui/Non) |
| `adresse_debut` | TEXT | Adresse de début |
| `adresse_fin` | TEXT | Adresse de fin |
| `created_at` | TIMESTAMP | Date de création |

### 3. `tct_history`
Historique des actions et événements.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | SERIAL | ID auto-incrémenté |
| `document_id` | INTEGER | Référence vers tct_documents (nullable) |
| `action` | VARCHAR(50) | Type d'action |
| `status` | VARCHAR(20) | success, error |
| `message` | TEXT | Message descriptif |
| `execution_time_ms` | INTEGER | Temps d'exécution en ms |
| `created_at` | TIMESTAMP | Date de création |

## Configuration n8n

### Étape 1 : Créer les tables PostgreSQL

1. Connectez-vous à votre base Neon PostgreSQL
2. Exécutez le script `n8n-workflows/create-tables.sql`

```bash
psql -h your-neon-host.neon.tech -U your-user -d your-db -f n8n-workflows/create-tables.sql
```

### Étape 2 : Importer le workflow n8n

1. Ouvrez n8n : https://n8n.srv679767.hstgr.cloud
2. Créez un nouveau workflow
3. Importez le fichier `n8n-workflows/tct-save-extraction.json`
4. Configurez les credentials PostgreSQL (neon-db)
5. Activez le workflow

### Étape 3 : Vérifier l'URL du webhook

Le webhook doit être accessible à :
```
https://n8n.srv679767.hstgr.cloud/webhook/tct-upload-document
```

Si l'URL est différente, mettez à jour dans :
- `src/services/n8nService.ts` (ligne 32)
- `api/save-to-n8n.ts` (ligne 28)

## Flux de sauvegarde

1. L'utilisateur upload et extrait un document TCT
2. L'utilisateur clique sur "Générer le Document Final"
3. `handleTctGenerateResults()` est appelé :
   - Construit le tableau unifié
   - Sauvegarde dans localStorage
   - **Appelle `/api/save-to-n8n` en arrière-plan**
4. L'API envoie les données au webhook n8n :
   ```json
   {
     "document": {
       "filename": "tct3.jpeg",
       "upload_date": "2026-01-20T02:00:00.000Z",
       "status": "success",
       "user_id": "1234",
       "extracted_count": 41
     },
     "tournees": [
       {
         "tournee": "TCT0028",
         "nom": "TAXI COOP TERREBONNE",
         "deb_tour": "6:30",
         ...
       },
       ...
     ],
     "user_id": "1234"
   }
   ```
5. Le workflow n8n :
   - Insère le document dans `tct_documents`
   - Récupère l'ID du document créé
   - Insère toutes les tournées dans `tct_tournees`
   - Enregistre un log dans `tct_history`
   - Retourne `{ success: true, document_id: 123 }`

## Gestion des erreurs

- Si n8n est indisponible, l'erreur est loggée en console mais **ne bloque pas l'utilisateur**
- Les données restent accessibles via localStorage
- Le retry n'est pas automatique (à implémenter si nécessaire)

## Vues SQL utiles

### Résumé par utilisateur
```sql
SELECT * FROM tct_documents_summary;
```

### Dernières extractions
```sql
SELECT * FROM tct_recent_extractions;
```

### Tournées d'un document spécifique
```sql
SELECT * FROM tct_tournees WHERE document_id = 123 ORDER BY tournee;
```

### Historique des actions
```sql
SELECT * FROM tct_history ORDER BY created_at DESC LIMIT 50;
```

## API Endpoints

### POST /api/save-to-n8n

Sauvegarde une extraction dans n8n.

**Request Body:**
```json
{
  "document": {
    "filename": "string",
    "upload_date": "ISO 8601 timestamp",
    "status": "success|error",
    "user_id": "string",
    "extracted_count": number
  },
  "tournees": [
    {
      "tournee": "string",
      "nom": "string",
      "deb_tour": "string",
      ...
    }
  ],
  "user_id": "string"
}
```

**Response:**
```json
{
  "success": true,
  "documentId": 123,
  "execution_time_ms": 456
}
```

## Logs et débogage

Les logs sont préfixés avec `[N8N]` ou `[TCT]` :

```
[TCT] Sauvegarde dans n8n...
[N8N] Envoi des données d'extraction: { filename: '...', tournees_count: 41 }
[N8N] Données sauvegardées avec succès: { documentId: 123 }
```

En cas d'erreur :
```
[TCT] Erreur sauvegarde n8n: Error: N8N Webhook Error (500): ...
```

## Tests

1. **Test manuel** :
   - Uploadez un document TCT
   - Extrayez les données
   - Cliquez sur "Générer le Document Final"
   - Vérifiez les logs dans la console
   - Vérifiez la base de données PostgreSQL

2. **Vérification SQL** :
   ```sql
   -- Vérifier le dernier document inséré
   SELECT * FROM tct_documents ORDER BY id DESC LIMIT 1;

   -- Vérifier les tournées associées
   SELECT COUNT(*) FROM tct_tournees WHERE document_id = (SELECT MAX(id) FROM tct_documents);
   ```

## Prochaines étapes

- [ ] Créer le webhook n8n pour récupérer les documents d'un utilisateur (`/webhook/tct-get-user-documents`)
- [ ] Créer le webhook n8n pour récupérer les tournées d'un document (`/webhook/tct-get-tournees`)
- [ ] Implémenter le retry automatique en cas d'échec
- [ ] Ajouter une interface d'administration pour consulter l'historique
- [ ] Créer des rapports et statistiques depuis les Data Tables

## Support

Pour toute question ou problème :
1. Vérifiez les logs de la console navigateur
2. Vérifiez les logs d'exécution n8n
3. Vérifiez la connexion PostgreSQL
4. Consultez ce README
