# 🔒 Guide de Sécurité - ADT

Ce document décrit les mesures de sécurité implémentées dans l'application ADT et les meilleures pratiques à suivre.

---

## ✅ Améliorations de Sécurité Implémentées

### 1. **CORS Sécurisé**

#### Avant (❌ Vulnérable)
```typescript
app.use(cors({
    origin: '*',  // Accepte TOUTES les origines - DANGEREUX!
    credentials: true,
}));
```

#### Après (✅ Sécurisé)
```typescript
app.use(cors({
    origin: (origin, callback) => {
        if (origin && allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`Origine non autorisée: ${origin}`));
        }
    },
    credentials: true,
}));
```

**Configuration:** Définissez `ALLOWED_ORIGINS` dans `.env.local`
```bash
ALLOWED_ORIGINS=http://localhost:3005,https://votre-domaine.com
```

---

### 2. **Validation des Données avec Zod**

Toutes les entrées utilisateur sont validées avec Zod pour prévenir les injections et les données malformées.

#### Exemple d'utilisation
```typescript
import { UserSchema, validateOrThrow } from './src/validation/schemas';

// Valide les données utilisateur
const validatedUser = validateOrThrow(UserSchema, userData);
```

#### Schémas disponibles
- `UserSchema` - Validation des utilisateurs
- `AISettingsSchema` - Validation des paramètres IA
- `ExtractionDataSchema` - Validation des extractions
- `EnvSchema` - Validation des variables d'environnement

---

### 3. **Protection contre XSS**

#### Sanitisation des chaînes
```typescript
import { sanitizeString } from './src/validation/schemas';

const clean = sanitizeString(userInput); // Supprime <script> et autres balises
```

#### ErrorBoundary React
```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

### 4. **Gestion Sécurisée des Secrets**

#### ❌ Ne JAMAIS faire
```typescript
// Stockage des clés API dans localStorage
localStorage.setItem('apiKey', 'sk-or-v1-...');
```

#### ✅ Recommandations

**Pour le développement local:**
- Utilisez `.env.local` (jamais commité)
- Les clés sont chargées côté serveur uniquement

**Pour la production:**
- Configurez les variables dans Vercel/Netlify
- Utilisez des services de gestion de secrets (AWS Secrets Manager, etc.)

**Frontend:**
```typescript
// N'envoyez JAMAIS la clé API depuis le frontend
// Passez par votre backend qui fait l'appel
const response = await fetch('/api/extract', {
    method: 'POST',
    body: JSON.stringify({ image: base64 }),
});
```

---

### 5. **Authentification et Sessions**

#### Configuration de session sécurisée
```env
SESSION_SECRET=votre-secret-généré-aléatoirement-32-chars-minimum
COOKIE_MAX_AGE=86400000  # 24 heures
```

#### Génération d'un secret sécurisé
```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### 6. **Protection de la Base de Données**

#### Schéma sécurisé
- ✅ Contraintes `NOT NULL` sur les champs critiques
- ✅ Index pour prévenir les scans complets
- ✅ Foreign keys avec `ON DELETE CASCADE`
- ✅ Validation des types (VARCHAR avec limites)

#### Prévention des injections SQL
```typescript
// ✅ Utilisez Drizzle ORM (paramètres échappés automatiquement)
const users = await db.select().from(schema.users).where(eq(schema.users.numDome, userInput));

// ❌ JAMAIS de SQL brut non paramétré
const users = await db.execute(`SELECT * FROM users WHERE num_dome = '${userInput}'`);
```

---

## 🔐 Checklist de Sécurité pour la Production

### Avant le déploiement

- [ ] Toutes les variables d'environnement sont configurées
- [ ] `ALLOWED_ORIGINS` ne contient que les domaines de production
- [ ] `SESSION_SECRET` est une chaîne aléatoire sécurisée (32+ chars)
- [ ] `NODE_ENV=production` est défini
- [ ] Les logs de debug sont désactivés (`ENABLE_DEBUG_LOGS=false`)
- [ ] HTTPS est activé sur tous les domaines
- [ ] Les headers de sécurité sont configurés (CSP, HSTS, etc.)

### Configuration Vercel recommandée

```bash
# Variables d'environnement Vercel
vercel env add DATABASE_URL
vercel env add OPENROUTER_API_KEY
vercel env add ALLOWED_ORIGINS
vercel env add SESSION_SECRET
vercel env add NODE_ENV production
vercel env add SENTRY_DSN  # Optionnel
```

---

## 🛡️ Bonnes Pratiques

### 1. **Ne jamais commiter de secrets**

Ajoutez à `.gitignore`:
```
.env.local
.env.production
*.key
*.pem
```

### 2. **Rotation des clés API**

- Changez les clés API tous les 3-6 mois
- Après un départ d'employé ayant eu accès
- Si une clé est compromise

### 3. **Audit régulier**

```bash
# Analyser les vulnérabilités npm
npm audit

# Mettre à jour les dépendances
npm update

# Vérifier les dépendances obsolètes
npm outdated
```

### 4. **Monitoring des erreurs**

Configurez Sentry pour être notifié des erreurs en production:

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## 🚨 Que Faire en Cas de Brèche

1. **Isoler immédiatement**
   - Désactiver les clés API compromises
   - Bloquer les origines suspectes dans CORS

2. **Investiguer**
   - Consulter les logs `audit_logs`
   - Identifier l'ampleur de la brèche

3. **Notifier**
   - Informer les utilisateurs affectés
   - Respecter le RGPD (72h de délai)

4. **Corriger**
   - Mettre à jour les dépendances
   - Renforcer les validations
   - Ajouter des tests de sécurité

5. **Documenter**
   - Post-mortem de l'incident
   - Actions préventives futures

---

## 📞 Contact Sécurité

Pour signaler une vulnérabilité:
- Email: security@adt.com
- Bug Bounty: https://github.com/zakibelm/ADT/security

**Merci de pratiquer la divulgation responsable!**
