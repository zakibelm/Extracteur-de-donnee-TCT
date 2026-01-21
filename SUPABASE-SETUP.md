# Configuration Supabase - Extraction TCT

## Vue d'ensemble

L'application TCT sauvegarde maintenant automatiquement toutes les extractions réussies dans **Supabase** (PostgreSQL) au lieu de n8n. Les données sont stockées en double : localStorage (pour l'interface) + Supabase (pour la persistance).

## Informations du projet Supabase

- **Project name**: Extraction data Project
- **Project ID**: `nmmmlsgvhupzdunclcvj`
- **Project URL**: https://nmmmlsgvhupzdunclcvj.supabase.co
- **API URL**: https://nmmmlsgvhupzdunclcvj.supabase.co/rest/v1

## Architecture

```
[Frontend App] → [Supabase Service] → [Supabase PostgreSQL]
     ↓                                         ↓
[localStorage]                          [tct_documents]
                                       [tct_tournees]
                                       [tct_history]
```

## Étape 1 : Créer les tables dans Supabase

1. **Allez dans le SQL Editor de Supabase** :
   - https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/sql

2. **Exécutez le script SQL** :
   - Ouvrez le fichier `supabase/create-tables.sql`
   - Copiez tout le contenu
   - Collez dans le SQL Editor
   - Cliquez sur "Run" ou appuyez sur Ctrl+Enter

3. **Vérifiez la création** :
   - Allez dans "Table Editor"
   - Vous devriez voir 3 tables : `tct_documents`, `tct_tournees`, `tct_history`

## Tables PostgreSQL

### 1. `tct_documents`
Stocke les métadonnées des documents uploadés.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | BIGSERIAL | ID auto-incrémenté |
| `filename` | VARCHAR(255) | Nom du fichier original |
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
| `id` | BIGSERIAL | ID auto-incrémenté |
| `document_id` | BIGINT | Référence vers tct_documents |
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
| `id` | BIGSERIAL | ID auto-incrémenté |
| `document_id` | BIGINT | Référence vers tct_documents (nullable) |
| `action` | VARCHAR(50) | Type d'action |
| `status` | VARCHAR(20) | success, error |
| `message` | TEXT | Message descriptif |
| `execution_time_ms` | INTEGER | Temps d'exécution en ms |
| `created_at` | TIMESTAMP | Date de création |

## Étape 2 : Configuration de la sécurité (RLS)

Le script SQL configure automatiquement Row Level Security (RLS) pour protéger les données :

- ✅ Les utilisateurs peuvent voir uniquement leurs propres documents
- ✅ Les utilisateurs peuvent insérer uniquement leurs propres documents
- ✅ Les tournées sont accessibles uniquement via les documents de l'utilisateur
- ✅ L'historique est accessible uniquement via les documents de l'utilisateur

**Note** : Pour le moment, le service utilise la clé `anon` qui contourne le RLS. Pour une vraie authentification utilisateur, vous devrez implémenter Supabase Auth.

## Étape 3 : Tester l'intégration

1. **Démarrez l'application** :
   ```bash
   npm run dev
   ```

2. **Uploadez un document TCT** :
   - Connectez-vous avec un utilisateur
   - Uploadez un fichier TCT (image ou PDF)
   - Extrayez les données
   - Cliquez sur "Générer le Document Final"

3. **Vérifiez les logs de la console** :
   ```
   [TCT] Sauvegarde dans Supabase...
   [Supabase] Sauvegarde extraction... { filename: '...', tournees_count: 41, user_id: '...' }
   [Supabase] Document inséré avec ID: 1
   [Supabase] Tournées insérées: 41
   [Supabase] Sauvegarde complète réussie en 234 ms
   [TCT] Sauvegarde Supabase réussie: { documentId: 1, tourneesCount: 41, executionTime: '234ms' }
   ```

4. **Vérifiez dans Supabase** :
   - Allez dans "Table Editor" → `tct_documents`
   - Vous devriez voir le document inséré
   - Allez dans `tct_tournees` → Vous devriez voir les tournées
   - Allez dans `tct_history` → Vous devriez voir le log

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
SELECT * FROM tct_tournees WHERE document_id = 1 ORDER BY tournee;
```

### Historique des actions
```sql
SELECT * FROM tct_history ORDER BY created_at DESC LIMIT 50;
```

### Compter les documents par utilisateur
```sql
SELECT user_id, COUNT(*) as total_documents
FROM tct_documents
GROUP BY user_id
ORDER BY total_documents DESC;
```

## Gestion des erreurs

- Si Supabase est indisponible, l'erreur est loggée en console mais **ne bloque pas l'utilisateur**
- Les données restent accessibles via localStorage
- Les erreurs sont automatiquement loggées dans la table `tct_history`
- Le retry n'est pas automatique (à implémenter si nécessaire)

## Configuration du client Supabase

Le client est configuré dans `src/lib/supabaseClient.ts` :

```typescript
const supabaseUrl = 'https://nmmmlsgvhupzdunclcvj.supabase.co';
const supabaseAnonKey = 'eyJhbGc...'; // Clé anon publique

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**⚠️ Important** : La clé `anon` est publique et safe pour le frontend car les permissions sont gérées par RLS.

## Service Supabase

Le service est dans `src/services/supabaseService.ts` et expose :

### `saveExtractionToSupabase(payload)`
Sauvegarde une extraction complète (document + tournées + historique).

**Paramètres** :
```typescript
{
  document: {
    filename: string;
    upload_date: string;
    status: 'success' | 'error';
    user_id: string;
    extracted_count: number;
  },
  tournees: Array<TourneeData>,
  user_id: string
}
```

**Retour** :
```typescript
{
  success: true,
  documentId: number,
  tourneesCount: number,
  executionTime: number
}
```

### `getUserDocuments(userId)`
Récupère tous les documents d'un utilisateur.

### `getDocumentTournees(documentId)`
Récupère toutes les tournées d'un document spécifique.

## Migration depuis n8n

Si vous aviez des données dans n8n, vous pouvez les migrer vers Supabase :

1. Exportez les données depuis n8n (via l'API ou SQL)
2. Adaptez le format si nécessaire
3. Importez dans Supabase via SQL ou l'API REST

## Prochaines étapes

- [ ] Implémenter Supabase Auth pour une vraie authentification utilisateur
- [ ] Créer une page d'administration pour consulter l'historique
- [ ] Ajouter des filtres et recherches dans l'historique
- [ ] Créer des rapports et statistiques depuis les données
- [ ] Implémenter le retry automatique en cas d'échec
- [ ] Ajouter des notifications en temps réel (Supabase Realtime)

## Support et débogage

### Logs de la console
Les logs sont préfixés avec `[TCT]` ou `[Supabase]` :

```
[TCT] Sauvegarde dans Supabase...
[Supabase] Sauvegarde extraction...
[Supabase] Document inséré avec ID: 1
[Supabase] Tournées insérées: 41
```

### Erreurs communes

**Erreur : "relation tct_documents does not exist"**
→ Les tables n'ont pas été créées. Exécutez le script `supabase/create-tables.sql`.

**Erreur : "JWT expired"**
→ La clé anon est expirée. Générez une nouvelle clé dans Supabase Settings → API.

**Erreur : "Row-level security policy violation"**
→ Vérifiez que les politiques RLS sont bien configurées ou utilisez la clé `service_role` pour les tests.

### Liens utiles

- Dashboard Supabase: https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj
- Table Editor: https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/editor
- SQL Editor: https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/sql
- API Docs: https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/api
- Documentation Supabase: https://supabase.com/docs
