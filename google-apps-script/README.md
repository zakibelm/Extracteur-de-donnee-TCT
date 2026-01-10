# Configuration Google Apps Script pour ADT

## Étapes de Configuration

### 1. Créer le Google Sheet

1. Aller sur https://sheets.google.com
2. Se connecter avec **zakibelm66@gmail.com**
3. Créer un nouveau Sheet nommé : **"ADT - Extractions TCT"**
4. Copier l'ID du Sheet depuis l'URL :
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```

### 2. Créer le Apps Script

1. Dans le Google Sheet, aller dans **Extensions > Apps Script**
2. Supprimer le code par défaut
3. Copier le contenu de `google-apps-script/Code.gs`
4. Remplacer `VOTRE_SHEET_ID_ICI` par l'ID du Sheet
5. Sauvegarder (Ctrl+S)

### 3. Déployer le Script

1. Cliquer sur **Déployer > Nouveau déploiement**
2. Type : **Application Web**
3. Paramètres :
   - Description : "ADT Extractions API"
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
4. Cliquer sur **Déployer**
5. Copier l'**URL de déploiement**

### 4. Configurer l'Application

1. Ouvrir `.env.local`
2. Ajouter/Modifier :
   ```
   APPS_SCRIPT_URL=https://script.google.com/macros/s/[VOTRE_DEPLOYMENT_ID]/exec
   GOOGLE_SHEET_ID=[VOTRE_SHEET_ID]
   ```

### 5. Tester

1. Lancer l'application
2. Extraire des documents
3. Cliquer sur "Exporter vers Sheets"
4. Vérifier que les données apparaissent dans le Google Sheet

## Structure du Google Sheet

### Feuille "Extractions"
| Timestamp | User | NumDome | Tournée | Nom | Début tournée | ... |
|-----------|------|---------|---------|-----|---------------|-----|
| 2026-01-09 | DEMO99 | DEMO99 | T001 | Jean | 08:00 | ... |

### Feuille "Users" (Backup)
| Timestamp | NumDome | IdEmploye | Email | Telephone | IsAdmin |
|-----------|---------|-----------|-------|-----------|---------|
| 2026-01-09 | DEMO99 | EMP001 | user@example.com | 514-555-1234 | false |

## API Endpoints

### POST - Sauvegarder tableau consolidé
```javascript
{
  "action": "save_consolidated",
  "numDome": "DEMO99",
  "userEmail": "user@example.com",
  "headers": ["Tournée", "Nom", "Début tournée", ...],
  "rows": [
    ["T001", "Jean", "08:00", ...],
    ["T002", "Marie", "09:00", ...]
  ]
}
```

### POST - Sauvegarder utilisateur
```javascript
{
  "action": "save_user",
  "numDome": "DEMO99",
  "idEmploye": "EMP001",
  "email": "user@example.com",
  "telephone": "514-555-1234",
  "isAdmin": false
}
```

### GET - Récupérer extractions
```
GET https://script.google.com/.../exec?action=get_extractions&numDome=DEMO99
```

## Permissions

Le script nécessite les permissions suivantes :
- ✅ Lire et modifier les feuilles Google
- ✅ Se connecter à des services externes
- ✅ Exécuter en tant qu'application web

## Sécurité

- Le script s'exécute avec votre compte (zakibelm66@gmail.com)
- Seules les personnes avec le lien peuvent envoyer des données
- Les données sont stockées dans votre Google Drive privé
