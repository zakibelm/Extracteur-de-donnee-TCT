# Guide de Dépannage - ADT Extracteur

## Erreur de Connexion

Si vous rencontrez l'erreur "Erreur de connexion. Veuillez vérifier la base de données ou vos identifiants", suivez ces étapes :

### 1. Vérifier la Console du Navigateur

Ouvrez la console développeur (F12 dans Chrome/Firefox) et regardez les messages d'erreur détaillés :
- **"Failed to fetch"** → L'API n'est pas accessible
- **"429"** → Trop de requêtes, attendez quelques instants
- **"400"** → Données invalides
- **"500"** → Erreur serveur/base de données

### 2. Problèmes Courants et Solutions

#### A. En Développement Local

Si vous développez en local avec `npm run dev` :

1. **Vérifier que l'API Vercel Dev tourne** :
   ```bash
   # Installer Vercel CLI si nécessaire
   npm i -g vercel

   # Démarrer en mode dev
   vercel dev
   ```

2. **Vérifier la variable DATABASE_URL** :
   ```bash
   # Dans le fichier .env
   DATABASE_URL="postgresql://..."
   ```

3. **Tester l'API directement** :
   ```bash
   # Test avec curl
   curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{"numDome":"999","idEmploye":"090","isAdmin":true}'
   ```

#### B. En Production (Vercel)

Si vous testez sur le site déployé :

1. **Vérifier que DATABASE_URL est configurée dans Vercel** :
   - Aller sur https://vercel.com/dashboard
   - Sélectionner le projet
   - Settings → Environment Variables
   - Ajouter `DATABASE_URL` avec la valeur Neon

2. **Vérifier les logs Vercel** :
   - Dashboard → Project → Logs
   - Regarder les erreurs d'API

3. **Redéployer après changement d'env** :
   ```bash
   vercel --prod
   ```

#### C. Problème de Base de Données Neon

1. **Vérifier que Neon est accessible** :
   - Aller sur https://console.neon.tech
   - Vérifier que le projet est actif
   - Tester la connexion avec psql

2. **Exécuter les migrations** :
   ```bash
   # Se connecter à Neon
   psql "postgresql://neondb_owner:npg_FWLgcBaUb82j@ep-misty-mouse-ahdK5n43-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

   # Vérifier les tables
   \dt

   # Si les tables n'existent pas, les créer
   \i migrations/001_add_indexes.sql
   ```

3. **Créer les tables manuellement** :
   ```sql
   -- Créer la table users
   CREATE TABLE IF NOT EXISTS users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     "numDome" VARCHAR(50) NOT NULL UNIQUE,
     "idEmploye" VARCHAR(50) NOT NULL,
     telephone VARCHAR(20),
     "isAdmin" BOOLEAN DEFAULT FALSE,
     "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Créer la table extractions
   CREATE TABLE IF NOT EXISTS extractions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     "userId" VARCHAR(50) NOT NULL,
     section VARCHAR(20) NOT NULL,
     "fileName" VARCHAR(255),
     status VARCHAR(50),
     content JSONB,
     "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY ("userId") REFERENCES users("numDome") ON DELETE CASCADE
   );

   -- Créer les index
   CREATE INDEX IF NOT EXISTS idx_extractions_user_id ON extractions("userId");
   CREATE INDEX IF NOT EXISTS idx_extractions_user_section ON extractions("userId", section);
   CREATE INDEX IF NOT EXISTS idx_extractions_created_desc ON extractions("createdAt" DESC);
   CREATE INDEX IF NOT EXISTS idx_users_num_dome ON users("numDome");
   ```

### 3. Tester le Health Check

Après le déploiement, testez l'endpoint de santé :

```bash
# En local
curl http://localhost:3000/api/health

# En production
curl https://extracteur-de-donnee-tct.vercel.app/api/health
```

Réponse attendue :
```json
{
  "status": "healthy",
  "timestamp": "2026-01-04T...",
  "database": {
    "status": "connected",
    "responseTime": 150
  },
  "api": {
    "version": "2.0.0",
    "environment": "production"
  }
}
```

### 4. Problème CORS

Si vous voyez des erreurs CORS dans la console :

1. **Vérifier l'origine** :
   L'API accepte uniquement ces origines :
   - https://adt-taxi-coop.vercel.app
   - https://adt-app.vercel.app
   - http://localhost:5173
   - http://localhost:3000

2. **Ajouter votre domaine** :
   Modifier `api/users.ts`, `api/extractions.ts`, `api/extract.ts` :
   ```typescript
   const ALLOWED_ORIGINS = [
       // ... origines existantes
       'https://votre-domaine.vercel.app'
   ];
   ```

### 5. Validation Zod

Si vous voyez "Validation failed" :

Les données doivent respecter ce format :
```json
{
  "numDome": "999",        // String, minimum 1 caractère
  "idEmploye": "090",      // String, minimum 1 caractère
  "telephone": "optional", // String optionnel
  "isAdmin": true          // Boolean
}
```

### 6. Rate Limiting

L'API a des limites :
- **100 requêtes/minute** pour les endpoints généraux
- **20 requêtes/minute** pour l'extraction AI

Si vous dépassez ces limites, attendez 1 minute avant de réessayer.

## Support

Pour plus d'aide :
1. Consultez les logs dans la console navigateur (F12)
2. Consultez les logs Vercel (Dashboard → Logs)
3. Vérifiez API_DOCUMENTATION.md pour les détails des endpoints

**Propulsé par Zakibelm © 2026**
