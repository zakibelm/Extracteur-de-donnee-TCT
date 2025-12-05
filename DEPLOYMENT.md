# 🚀 Configuration du Déploiement Automatique sur Google Cloud Run

## 📋 Prérequis

Pour activer le déploiement automatique, vous devez configurer les secrets GitHub suivants :

### 1. **GCP_PROJECT_ID**
- Votre ID de projet Google Cloud
- Exemple : `mon-projet-123456`

### 2. **GCP_SA_KEY**
- Clé JSON du compte de service Google Cloud
- Permissions requises :
  - Cloud Run Admin
  - Storage Admin
  - Service Account User

### 3. **VITE_GEMINI_API_KEY**
- Votre clé API Gemini pour l'extraction de données

## 🔧 Étapes de Configuration

### Étape 1 : Créer un compte de service Google Cloud

```bash
# Se connecter à Google Cloud
gcloud auth login

# Définir votre projet
gcloud config set project VOTRE_PROJECT_ID

# Créer un compte de service
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deployer"

# Attribuer les rôles nécessaires
gcloud projects add-iam-policy-binding VOTRE_PROJECT_ID \
    --member="serviceAccount:github-actions@VOTRE_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding VOTRE_PROJECT_ID \
    --member="serviceAccount:github-actions@VOTRE_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding VOTRE_PROJECT_ID \
    --member="serviceAccount:github-actions@VOTRE_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

# Créer et télécharger la clé JSON
gcloud iam service-accounts keys create key.json \
    --iam-account=github-actions@VOTRE_PROJECT_ID.iam.gserviceaccount.com
```

### Étape 2 : Configurer les secrets GitHub

1. Allez sur votre dépôt GitHub : https://github.com/zakibelm/Extracteur-de-donnee-TCT
2. Cliquez sur **Settings** → **Secrets and variables** → **Actions**
3. Ajoutez les secrets suivants :

   - **GCP_PROJECT_ID** : Votre ID de projet Google Cloud
   - **GCP_SA_KEY** : Contenu complet du fichier `key.json`
   - **VITE_GEMINI_API_KEY** : Votre clé API Gemini

### Étape 3 : Activer les APIs Google Cloud

```bash
# Activer Cloud Run API
gcloud services enable run.googleapis.com

# Activer Container Registry API
gcloud services enable containerregistry.googleapis.com

# Activer Cloud Build API
gcloud services enable cloudbuild.googleapis.com
```

## 🎯 Déploiement

Une fois configuré, chaque push sur la branche `main` déclenchera automatiquement :

1. ✅ Construction de l'image Docker
2. ✅ Push vers Google Container Registry
3. ✅ Déploiement sur Cloud Run
4. ✅ Affichage de l'URL de déploiement

## 🔗 URL de Production

Après le déploiement, votre application sera accessible à :
```
https://adt-extracteur-de-donnees-tabulaires-XXXXXXXXX-uw.a.run.app
```

## 📊 Monitoring

Surveillez vos déploiements :
- **GitHub Actions** : https://github.com/zakibelm/Extracteur-de-donnee-TCT/actions
- **Cloud Run Console** : https://console.cloud.google.com/run
- **Logs** : https://console.cloud.google.com/logs

## 🛠️ Déploiement Manuel (Alternative)

Si vous préférez déployer manuellement :

```bash
# Installer gcloud CLI si nécessaire
# https://cloud.google.com/sdk/docs/install

# Se connecter
gcloud auth login

# Définir le projet
gcloud config set project VOTRE_PROJECT_ID

# Déployer
gcloud run deploy adt-extracteur-de-donnees-tabulaires \
  --source . \
  --platform managed \
  --region us-west1 \
  --allow-unauthenticated
```

## 🔒 Sécurité

- ⚠️ **Ne commitez JAMAIS** le fichier `key.json` dans Git
- ✅ Le fichier `.gitignore` exclut déjà `*.json` et `.env*`
- ✅ Utilisez toujours les secrets GitHub pour les informations sensibles

## 📝 Notes

- Le déploiement prend environ 2-5 minutes
- L'application utilise 512Mi de RAM et 1 CPU
- Auto-scaling de 0 à 10 instances
- Timeout de 300 secondes (5 minutes)
