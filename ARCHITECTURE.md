# Architecture Technique

## Vue d'Ensemble

ADT est une application full-stack TypeScript utilisant React pour le frontend, Express pour le backend local, et Vercel Serverless pour la production.

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  React   │  │   Vite   │  │   GSAP   │  │ Tailwind │   │
│  │  19.2.0  │  │  7.3.0   │  │  3.14.2  │  │   CSS    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  Components: AuthPage, Sidebar, FileUploader, etc.          │
│  Services: geminiService, aiService, n8n                    │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/Proxy
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (Local)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express 5.2 Server (local-server.ts)               │   │
│  │  Port: 3002                                          │   │
│  │  - CORS enabled                                      │   │
│  │  - Request logging                                   │   │
│  │  - Circuit breaker (mock mode si DB down)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Production)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Vercel Serverless Functions (supprimé en local)    │   │
│  │  - api/users.ts (supprimé)                           │   │
│  │  - api/extractions.ts (supprimé)                     │   │
│  │  - api/gemini.ts (supprimé)                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      BASE DE DONNÉES                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Neon PostgreSQL (Serverless)                       │   │
│  │  - users table                                       │   │
│  │  - extractions table                                 │   │
│  │  - Drizzle ORM 0.30                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     SERVICES EXTERNES                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  OpenRouter  │  │   Vercel     │  │     Neon     │      │
│  │  (IA API)    │  │  (Hosting)   │  │  (Database)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Structure des Dossiers

```
Extracteur-de-donnee-TCT/
├── components/              # Composants React (nouvelle structure)
│   ├── AuthPage.tsx        # Page d'authentification
│   ├── Sidebar.tsx         # Barre latérale navigation
│   ├── FileUploader.tsx    # Upload de fichiers
│   ├── FinalDocumentView.tsx
│   ├── ResultCard.tsx
│   ├── Button.tsx
│   ├── Modal.tsx
│   ├── Icons.tsx
│   ├── ChatInterface.tsx
│   ├── MainContent.tsx
│   └── SettingsModal.tsx
│
├── services/               # Services métier
│   ├── geminiService.ts   # Service extraction IA (OpenRouter)
│   ├── aiService.ts       # Service IA générique
│   ├── gasService.ts      # Service Google Apps Script
│   └── n8n.ts            # Intégration n8n
│
├── src/                   # Sources (ancienne structure, en migration)
│   ├── components/        # Anciens composants
│   │   ├── CalendarView.tsx
│   │   ├── ReportView.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── SettingsView.tsx
│   │   └── ErrorBoundary.tsx
│   ├── db/               # Configuration base de données
│   │   ├── index.ts      # Client Drizzle
│   │   ├── schema.ts     # Schémas tables
│   │   └── migrate.ts    # Migrations
│   └── services/         # Anciens services
│
├── api/                  # Endpoints Vercel (supprimés en local)
│   └── (vide)
│
├── types.ts              # Types TypeScript globaux
├── App.tsx               # Composant racine
├── index.tsx             # Point d'entrée React
├── index.html            # Template HTML
├── local-server.ts       # Serveur Express local
├── vite.config.ts        # Configuration Vite
├── tsconfig.json         # Configuration TypeScript
├── package.json          # Dépendances npm
└── README.md             # Documentation
```

## Flux de Données

### 1. Authentification

```
User Input → AuthPage → api.loginUser() → Express /api/users
                                              ↓
                                         PostgreSQL
                                              ↓
                                         User Object
                                              ↓
                                         localStorage
                                              ↓
                                         App State
```

### 2. Extraction de Données

```
File Upload → FileUploader → geminiService.extractDataFromImage()
                                    ↓
                              Base64 Encoding
                                    ↓
                              POST /api/gemini (proxy)
                                    ↓
                              OpenRouter API
                                    ↓
                              JSON Response
                                    ↓
                              Validation (observeData)
                                    ↓
                              Correction (si nécessaire)
                                    ↓
                              api.saveExtraction()
                                    ↓
                              PostgreSQL
                                    ↓
                              UI Update (CalendarView/ReportView)
```

### 3. Export de Données

```
User Click → ReportView/CalendarView → jsPDF.generate()
                                              ↓
                                         PDF Blob
                                              ↓
                                         Download
```

## Composants Clés

### Frontend

#### AuthPage.tsx
- **Rôle** : Authentification utilisateur
- **État** : numDome, idEmploye, telephone, accountType
- **API** : `api.loginUser()`
- **Animations** : GSAP (intro, transitions)

#### Sidebar.tsx
- **Rôle** : Navigation principale
- **Sections** : Extraction TCT, Extraction Olymel, Paramètres
- **État** : activeSection, user info
- **Événements** : onSectionChange, onLogout

#### FileUploader.tsx
- **Rôle** : Upload et traitement de fichiers
- **Formats** : Images (PNG, JPG), PDFs
- **Validation** : Taille max, type MIME
- **Traitement** : Base64 encoding, extraction IA

#### CalendarView.tsx
- **Rôle** : Visualisation calendrier Olymel
- **Données** : Extractions groupées par date
- **Fonctionnalités** : Recherche, filtres, export

#### ReportView.tsx
- **Rôle** : Tableau consolidé TCT
- **Données** : Toutes les extractions TCT
- **Fonctionnalités** : Tri, recherche, export PDF/CSV

### Services

#### geminiService.ts
- **Fonction principale** : `extractDataFromImage()`
- **Pattern** : Observe-Execute
  1. Extraction initiale
  2. Validation (observeData)
  3. Correction si erreurs
- **Schémas** : TCT, Olymel
- **API** : OpenRouter (proxy `/api/gemini`)

#### aiService.ts
- **Rôle** : Service IA générique
- **Fonctions** : Extraction, validation, correction
- **Configuration** : Modèle, température, prompts

### Backend

#### local-server.ts
- **Framework** : Express 5.2
- **Port** : 3002
- **Middleware** :
  - CORS (origin: *)
  - JSON body parser (limit: 50mb)
  - Request logging
  - Private Network Access headers
- **Circuit Breaker** : Mock mode si DB down
- **Routes** :
  - `GET /api/test` - Health check
  - `POST /api/users` - Login/signup
  - `GET /api/extractions` - Liste extractions
  - `POST /api/extractions` - Sauvegarde
  - `DELETE /api/extractions/:id` - Suppression

## Base de Données

### Schéma

```sql
-- users table
CREATE TABLE users (
  num_dome VARCHAR(50) PRIMARY KEY,
  id_employe VARCHAR(50) NOT NULL,
  telephone VARCHAR(20),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- extractions table
CREATE TABLE extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_dome VARCHAR(50) REFERENCES users(num_dome),
  section VARCHAR(20) NOT NULL, -- 'tct' or 'olymel'
  file_name VARCHAR(255),
  status VARCHAR(20),
  content JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### ORM (Drizzle)

```typescript
// src/db/schema.ts
export const users = pgTable('users', {
  numDome: varchar('num_dome', { length: 50 }).primaryKey(),
  idEmploye: varchar('id_employe', { length: 50 }).notNull(),
  telephone: varchar('telephone', { length: 20 }),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const extractions = pgTable('extractions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userDome: varchar('user_dome', { length: 50 }).references(() => users.numDome),
  section: varchar('section', { length: 20 }).notNull(),
  fileName: varchar('file_name', { length: 255 }),
  status: varchar('status', { length: 20 }),
  content: jsonb('content'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

## API OpenRouter

### Configuration

```typescript
// vite.config.ts
define: {
  'process.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY || "")
}
```

### Modèles Disponibles

```typescript
const MODELS = [
  'openai/gpt-4o',              // Défaut
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'mistral/mistral-large',
  'meta-llama/llama-3.1-70b-instruct',
];
```

### Requête Type

```typescript
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer sk-or-v1-...
  Content-Type: application/json

Body:
{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "system",
      "content": "Tu es un extracteur de données..."
    },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Extrais les données..." },
        { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
      ]
    }
  ],
  "temperature": 0.1,
  "response_format": { "type": "json_object" }
}
```

## Déploiement

### Environnements

| Environnement | URL | Backend | Database |
|---------------|-----|---------|----------|
| **Local** | http://localhost:3003 | Express (3002) | Neon |
| **Production** | https://extracteur-de-donnee-tct.vercel.app | Vercel Serverless | Neon |

### Build Process

```bash
# 1. Install dependencies
npm install

# 2. Build frontend
npm run build
# → Génère dist/

# 3. Deploy to Vercel
vercel --prod
# → Upload dist/ + serverless functions
```

### Variables d'Environnement

**Local** (`.env.local`):
```env
DATABASE_URL=postgresql://...
OPENROUTER_API_KEY=sk-or-v1-...
```

**Vercel** (Project Settings):
- `DATABASE_URL`
- `OPENROUTER_API_KEY`

## Sécurité

### Authentification
- Pas de JWT (pour l'instant)
- Session stockée dans localStorage
- Validation côté serveur

### API Keys
- Stockées dans variables d'environnement
- Jamais exposées au client
- Rotation régulière recommandée

### Base de Données
- SSL/TLS obligatoire
- Connexions poolées
- Requêtes paramétrées (Drizzle ORM)

### CORS
- Autorisé pour tous les origins en dev
- Restreindre en production

## Performance

### Frontend
- **Code Splitting** : Vite lazy loading
- **Optimisation Images** : Compression avant upload
- **Caching** : localStorage pour user data
- **Animations** : GSAP optimisé

### Backend
- **Connection Pooling** : Neon serverless
- **Circuit Breaker** : Mock mode si DB down
- **Request Logging** : Performance monitoring

### Base de Données
- **Indexes** : Sur numDome, section, created_at
- **Queries** : Optimisées avec Drizzle
- **Serverless** : Auto-scaling Neon

## Monitoring

### Logs
- **Frontend** : Console.log (dev), Sentry (prod)
- **Backend** : Express morgan logger
- **Database** : Neon dashboard

### Métriques
- **Vercel Analytics** : Page views, performance
- **OpenRouter** : API usage, costs
- **Neon** : Database queries, connections

## Évolutions Futures

### Court Terme
- [ ] Tests unitaires (Jest, React Testing Library)
- [ ] Tests E2E (Playwright)
- [ ] CI/CD GitHub Actions
- [ ] Monitoring Sentry

### Moyen Terme
- [ ] API REST publique
- [ ] Webhooks
- [ ] Export Google Sheets
- [ ] Mode clair/sombre

### Long Terme
- [ ] Mobile app (React Native)
- [ ] Desktop app (Electron)
- [ ] Multi-tenancy
- [ ] Analytics dashboard

---

**Dernière mise à jour** : Janvier 2026
