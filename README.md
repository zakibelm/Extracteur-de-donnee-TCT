# ADT - Extracteur de Données Tabulaires

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.3.0-646CFF?logo=vite)

**Application d'extraction intelligente de données tabulaires à partir d'images et de PDFs**

[Démo en Direct](https://extracteur-de-donnee-tct.vercel.app/) · [Signaler un Bug](https://github.com/zakibelm/Extracteur-de-donnee-TCT/issues) · [Demander une Fonctionnalité](https://github.com/zakibelm/Extracteur-de-donnee-TCT/issues)

</div>

---

## 📋 Table des Matières

- [À Propos](#-à-propos)
- [Fonctionnalités](#-fonctionnalités)
- [Technologies](#-technologies)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Utilisation](#-utilisation)
- [Architecture](#-architecture)
- [Déploiement](#-déploiement)
- [Contribution](#-contribution)
- [License](#-license)

---

## 🎯 À Propos

**ADT - Extracteur de Données Tabulaires** est une application web moderne qui utilise l'intelligence artificielle pour extraire, structurer et consolider des données tabulaires à partir d'images et de documents PDF. Conçue spécifiquement pour les secteurs de la logistique et du transport, elle automatise le processus fastidieux de saisie manuelle de données.

### Cas d'Usage Principaux

- **Extraction TCT** : Affectations de tournées logistiques
- **Extraction Olymel** : Horaires de transport
- **Consolidation** : Fusion et nettoyage de données multi-sources
- **Export** : Génération de rapports PDF et CSV

---

## ✨ Fonctionnalités

### 🤖 Extraction Intelligente
- **IA Multi-Modèles** : Support de 6 modèles d'IA via OpenRouter (GPT-4o, Claude, Mistral, Llama)
- **OCR Avancé** : Reconnaissance de texte dans images et PDFs
- **Validation Automatique** : Vérification de cohérence des données extraites
- **Correction Intelligente** : Détection et correction d'erreurs

### 📊 Gestion des Données
- **Vue Calendrier** : Visualisation chronologique des extractions Olymel
- **Vue Rapport** : Tableau consolidé des données TCT
- **Export Multi-Format** : PDF, CSV, JSON
- **Historique** : Sauvegarde automatique dans PostgreSQL

### 👥 Authentification
- **Multi-Rôles** : Admin (Répartition) et Conducteur
- **Gestion Utilisateurs** : Stockage sécurisé avec Neon PostgreSQL
- **Sessions** : Persistance des données utilisateur

### 🎨 Interface Moderne
- **Design Glassmorphism** : Interface élégante et moderne
- **Animations GSAP** : Transitions fluides
- **Responsive** : Optimisé mobile, tablette et desktop
- **Dark Mode** : Interface sombre par défaut

---

## 🛠️ Technologies

### Frontend
- **React 19.2** - Framework UI
- **TypeScript 5.8** - Typage statique
- **Vite 7.3** - Build tool ultra-rapide
- **GSAP 3.14** - Animations
- **Tailwind CSS** - Styling (via index.css)
- **Lucide React** - Icônes

### Backend
- **Express 5.2** - Serveur API local
- **Vercel Serverless** - Déploiement production
- **Neon PostgreSQL** - Base de données
- **Drizzle ORM 0.30** - ORM TypeScript

### IA & Extraction
- **OpenRouter API** - Gateway multi-modèles IA
- **PDF.js 5.4** - Parsing de PDFs
- **jsPDF 2.5** - Génération de PDFs

### DevOps
- **Vercel** - Hébergement et CI/CD
- **GitHub Actions** - Automatisation
- **ESLint** - Linting
- **TypeScript** - Type checking

---

## 🚀 Installation

### Prérequis

- **Node.js** 18.x ou supérieur
- **npm** 9.x ou supérieur
- **Git**
- **Compte OpenRouter** (pour l'API IA)
- **Compte Neon** (pour la base de données)

### Installation Locale

```bash
# 1. Cloner le dépôt
git clone https://github.com/zakibelm/Extracteur-de-donnee-TCT.git
cd Extracteur-de-donnee-TCT

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés API

# 4. Démarrer le serveur backend (terminal 1)
npx tsx local-server.ts

# 5. Démarrer le serveur frontend (terminal 2)
npm run dev
```

L'application sera accessible sur **http://localhost:3003**

---

## ⚙️ Configuration

### Variables d'Environnement

Créez un fichier `.env.local` à la racine du projet :

```env
# Base de données Neon PostgreSQL
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# OpenRouter API (pour l'IA)
OPENROUTER_API_KEY="sk-or-v1-..."

# Optionnel : Google Gemini (legacy, non utilisé)
GEMINI_API_KEY="AIzaSy..."
```

### Configuration OpenRouter

1. Créez un compte sur [OpenRouter](https://openrouter.ai/)
2. Générez une clé API
3. Ajoutez des crédits (minimum 5$)
4. Copiez la clé dans `.env.local`

### Configuration Neon Database

1. Créez un compte sur [Neon](https://neon.tech/)
2. Créez un nouveau projet
3. Copiez la chaîne de connexion PostgreSQL
4. Ajoutez-la dans `.env.local`
5. Exécutez les migrations :

```bash
npm run db:generate
npm run db:migrate
```

---

## 📖 Utilisation

### 1. Connexion

- **Admin (Répartition)** : Accès complet, gestion des extractions
- **Conducteur** : Consultation des données personnelles

Identifiants de test :
- Numéro de Dôme : `402`
- ID Employé : `919`

### 2. Extraction TCT

1. Cliquez sur **"Extraction TCT"** dans la sidebar
2. Glissez-déposez une image ou PDF
3. Attendez l'extraction (15-30 secondes)
4. Vérifiez les données dans la vue **"Rapport"**
5. Exportez en PDF ou CSV

### 3. Extraction Olymel

1. Cliquez sur **"Extraction Olymel"** dans la sidebar
2. Importez le manifeste (image/PDF)
3. Visualisez dans la vue **"Calendrier"**
4. Exportez les horaires

### 4. Paramètres

Accédez aux paramètres pour :
- Configurer la clé API OpenRouter
- Choisir le modèle d'IA (GPT-4o, Claude, etc.)
- Personnaliser les prompts système
- Activer/désactiver le RAG

---

## 🏗️ Architecture

### Structure du Projet

```
Extracteur-de-donnee-TCT/
├── components/          # Composants React (nouvelle structure)
│   ├── AuthPage.tsx
│   ├── Sidebar.tsx
│   ├── FileUploader.tsx
│   └── ...
├── services/           # Services métier
│   ├── geminiService.ts  # Service d'extraction IA
│   ├── aiService.ts      # Service IA générique
│   └── n8n.ts           # Intégration n8n
├── src/               # Sources (ancienne structure, en migration)
│   ├── components/
│   ├── db/            # Configuration base de données
│   └── services/
├── api/               # Endpoints Vercel Serverless (supprimé en local)
├── local-server.ts    # Serveur Express local
├── vite.config.ts     # Configuration Vite
└── package.json
```

### Flux de Données

```
User Upload → FileUploader → geminiService → OpenRouter API
                                    ↓
                              Validation & Cleaning
                                    ↓
                              PostgreSQL (Neon)
                                    ↓
                              CalendarView / ReportView
```

### Modèles IA Disponibles

| Modèle | Provider | Coût | Vitesse | Qualité |
|--------|----------|------|---------|---------|
| **GPT-4o** | OpenAI | $$$ | Rapide | Excellente |
| GPT-4o Mini | OpenAI | $ | Très rapide | Bonne |
| Claude 3.5 Sonnet | Anthropic | $$$ | Moyen | Excellente |
| Claude 3 Haiku | Anthropic | $ | Très rapide | Bonne |
| Mistral Large | Mistral | $$ | Rapide | Très bonne |
| Llama 3.1 70B | Meta | $ | Rapide | Bonne |

---

## 🌐 Déploiement

### Déploiement sur Vercel

```bash
# 1. Installer Vercel CLI
npm install -g vercel

# 2. Se connecter
vercel login

# 3. Déployer
vercel --prod
```

### Variables d'Environnement Vercel

Ajoutez dans les paramètres du projet Vercel :
- `DATABASE_URL`
- `OPENROUTER_API_KEY`

### Build de Production

```bash
npm run build
npm run preview
```

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

### Workflow de Contribution

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add AmazingFeature'`)
4. Pushez vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

## 📝 Changelog

Voir [version.json](version.json) pour l'historique des versions.

### Version 1.0.0 (Janvier 2026)
- ✅ Suppression du SDK Gemini
- ✅ Migration vers OpenRouter (6 modèles)
- ✅ Correction du serveur backend
- ✅ Amélioration de l'interface utilisateur
- ✅ Documentation complète

---

## 📄 License

Ce projet est sous licence MIT. Voir [LICENSE](LICENSE) pour plus de détails.

---

## 👤 Auteur

**Zaki Belm**
- GitHub: [@zakibelm](https://github.com/zakibelm)
- Email: zakibelm66@gmail.com

---

## 🙏 Remerciements

- [OpenRouter](https://openrouter.ai/) pour l'API multi-modèles
- [Neon](https://neon.tech/) pour la base de données PostgreSQL
- [Vercel](https://vercel.com/) pour l'hébergement
- [React](https://react.dev/) et [Vite](https://vitejs.dev/) pour les outils de développement

---

<div align="center">

**⭐ Si ce projet vous a aidé, n'hésitez pas à lui donner une étoile ! ⭐**

Made with ❤️ by Zaki Belm

</div>
