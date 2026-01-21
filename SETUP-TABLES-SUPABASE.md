# Configuration des Tables Supabase - Guide Complet

## Vue d'ensemble

Ce guide vous explique comment créer toutes les tables nécessaires dans Supabase pour votre application TCT avec authentification.

## Étapes à suivre

### 1. Accéder au SQL Editor de Supabase

Ouvrez le SQL Editor: https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/sql/new

### 2. Exécuter les scripts SQL dans l'ordre

Vous devez exécuter **2 scripts SQL** dans cet ordre précis:

---

## SCRIPT 1: Tables de base (create-tables.sql)

**Description**: Crée les tables pour stocker les documents TCT, tournées et historique.

**Fichier source**: `supabase/create-tables.sql`

**À copier-coller dans le SQL Editor**:

```sql
-- Script SQL pour créer les tables TCT dans Supabase
-- À exécuter dans le SQL Editor de Supabase

-- Table pour les documents TCT
CREATE TABLE IF NOT EXISTS tct_documents (
    id BIGSERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    user_id VARCHAR(50) NOT NULL,
    extracted_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide par utilisateur
CREATE INDEX IF NOT EXISTS idx_tct_documents_user_id ON tct_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_tct_documents_upload_date ON tct_documents(upload_date DESC);

-- Table pour les tournées extraites
CREATE TABLE IF NOT EXISTS tct_tournees (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES tct_documents(id) ON DELETE CASCADE,
    tournee VARCHAR(100),
    nom VARCHAR(255),
    deb_tour VARCHAR(50),
    fin_tour VARCHAR(50),
    cl_veh VARCHAR(50),
    employe VARCHAR(100),
    nom_employe VARCHAR(255),
    employe_confirm VARCHAR(100),
    vehicule VARCHAR(100),
    cl_veh_aff VARCHAR(50),
    autoris VARCHAR(50),
    approuve VARCHAR(50),
    retour VARCHAR(50),
    adresse_debut TEXT,
    adresse_fin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide par document
CREATE INDEX IF NOT EXISTS idx_tct_tournees_document_id ON tct_tournees(document_id);
CREATE INDEX IF NOT EXISTS idx_tct_tournees_tournee ON tct_tournees(tournee);

-- Table pour l'historique des actions
CREATE TABLE IF NOT EXISTS tct_history (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES tct_documents(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide par document et date
CREATE INDEX IF NOT EXISTS idx_tct_history_document_id ON tct_history(document_id);
CREATE INDEX IF NOT EXISTS idx_tct_history_created_at ON tct_history(created_at DESC);

-- Vue pour obtenir un résumé des documents par utilisateur
CREATE OR REPLACE VIEW tct_documents_summary AS
SELECT
    d.user_id,
    COUNT(DISTINCT d.id) as total_documents,
    SUM(d.extracted_count) as total_tournees,
    MAX(d.upload_date) as last_upload_date,
    COUNT(CASE WHEN d.status = 'success' THEN 1 END) as successful_extractions,
    COUNT(CASE WHEN d.status = 'error' THEN 1 END) as failed_extractions
FROM tct_documents d
GROUP BY d.user_id;

-- Vue pour obtenir les derniers documents avec leurs tournées
CREATE OR REPLACE VIEW tct_recent_extractions AS
SELECT
    d.id as document_id,
    d.filename,
    d.upload_date,
    d.user_id,
    d.extracted_count,
    d.status,
    COUNT(t.id) as saved_tournees
FROM tct_documents d
LEFT JOIN tct_tournees t ON t.document_id = d.id
GROUP BY d.id, d.filename, d.upload_date, d.user_id, d.extracted_count, d.status
ORDER BY d.upload_date DESC
LIMIT 50;

-- Activer Row Level Security (RLS) pour la sécurité
ALTER TABLE tct_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tct_tournees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tct_history ENABLE ROW LEVEL SECURITY;

-- Politique RLS: Les utilisateurs peuvent voir seulement leurs propres documents
CREATE POLICY "Users can view their own documents"
ON tct_documents FOR SELECT
USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

-- Politique RLS: Les utilisateurs peuvent insérer leurs propres documents
CREATE POLICY "Users can insert their own documents"
ON tct_documents FOR INSERT
WITH CHECK (auth.uid()::text = user_id OR auth.role() = 'service_role');

-- Politique RLS: Les utilisateurs peuvent mettre à jour leurs propres documents
CREATE POLICY "Users can update their own documents"
ON tct_documents FOR UPDATE
USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

-- Politique RLS: Les tournées sont accessibles via le document
CREATE POLICY "Users can view tournees of their documents"
ON tct_tournees FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM tct_documents
        WHERE tct_documents.id = tct_tournees.document_id
        AND (tct_documents.user_id = auth.uid()::text OR auth.role() = 'service_role')
    )
);

-- Politique RLS: Insertion des tournées via le document
CREATE POLICY "Users can insert tournees for their documents"
ON tct_tournees FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tct_documents
        WHERE tct_documents.id = tct_tournees.document_id
        AND (tct_documents.user_id = auth.uid()::text OR auth.role() = 'service_role')
    )
);

-- Politique RLS: L'historique est accessible via le document
CREATE POLICY "Users can view history of their documents"
ON tct_history FOR SELECT
USING (
    document_id IS NULL OR
    EXISTS (
        SELECT 1 FROM tct_documents
        WHERE tct_documents.id = tct_history.document_id
        AND (tct_documents.user_id = auth.uid()::text OR auth.role() = 'service_role')
    )
);

-- Politique RLS: Insertion dans l'historique
CREATE POLICY "Users can insert history for their documents"
ON tct_history FOR INSERT
WITH CHECK (
    document_id IS NULL OR
    EXISTS (
        SELECT 1 FROM tct_documents
        WHERE tct_documents.id = tct_history.document_id
        AND (tct_documents.user_id = auth.uid()::text OR auth.role() = 'service_role')
    )
);

-- Commentaires pour la documentation
COMMENT ON TABLE tct_documents IS 'Stocke les métadonnées des documents TCT uploadés';
COMMENT ON TABLE tct_tournees IS 'Stocke les tournées extraites des documents TCT';
COMMENT ON TABLE tct_history IS 'Historique des actions et événements liés aux extractions';
```

**Cliquez sur "Run"** pour exécuter ce premier script.

---

## SCRIPT 2: Table utilisateurs et connexion auth (add-users-table.sql)

**Description**: Crée la table `users` qui fait le lien entre Supabase Auth et votre application.

**Fichier source**: `supabase/add-users-table.sql`

**À copier-coller dans le SQL Editor** (dans une nouvelle requête):

```sql
-- Script SQL pour ajouter la table users
-- Cette table stocke les informations utilisateur supplémentaires
-- et fait le lien avec auth.users de Supabase

-- Table pour les utilisateurs de l'application
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    num_dome VARCHAR(100) NOT NULL,
    id_employe VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(50),
    role VARCHAR(20) NOT NULL DEFAULT 'driver',
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_num_dome ON users(num_dome);
CREATE INDEX IF NOT EXISTS idx_users_id_employe ON users(id_employe);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Activer Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Politique RLS: Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Politique RLS: Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Politique RLS: Les admins peuvent voir tous les profils
CREATE POLICY "Admins can view all profiles"
ON users FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

-- Fonction pour créer automatiquement un profil utilisateur après l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
        num_dome,
        id_employe,
        email,
        telephone,
        role,
        is_admin
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'numDome', NEW.id::text),
        COALESCE(NEW.raw_user_meta_data->>'employeeId', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'driver'),
        COALESCE((NEW.raw_user_meta_data->>'role')::text = 'admin', false)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer automatiquement le profil utilisateur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS set_updated_at ON users;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Modifier la table tct_documents pour utiliser UUID au lieu de VARCHAR
-- Note: Si des données existent déjà, cette migration peut nécessiter des ajustements
ALTER TABLE tct_documents
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

-- Ajouter une contrainte de clé étrangère vers users
ALTER TABLE tct_documents
    ADD CONSTRAINT fk_tct_documents_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE;

-- Mettre à jour les politiques RLS de tct_documents pour utiliser UUID
DROP POLICY IF EXISTS "Users can view their own documents" ON tct_documents;
CREATE POLICY "Users can view their own documents"
ON tct_documents FOR SELECT
USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can insert their own documents" ON tct_documents;
CREATE POLICY "Users can insert their own documents"
ON tct_documents FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can update their own documents" ON tct_documents;
CREATE POLICY "Users can update their own documents"
ON tct_documents FOR UPDATE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Commentaires
COMMENT ON TABLE users IS 'Profils utilisateurs étendus liés à auth.users';
COMMENT ON COLUMN users.num_dome IS 'Numéro de dôme du chauffeur';
COMMENT ON COLUMN users.id_employe IS 'Identifiant employé';
COMMENT ON COLUMN users.role IS 'Rôle: admin ou driver';
COMMENT ON COLUMN users.is_admin IS 'Indique si l''utilisateur est administrateur';
```

**Cliquez sur "Run"** pour exécuter ce second script.

---

## Vérification

Après l'exécution des 2 scripts, vérifiez dans le **Table Editor**:
https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/editor

Vous devriez voir **4 tables**:
- ✅ `users` - Profils utilisateurs
- ✅ `tct_documents` - Documents uploadés
- ✅ `tct_tournees` - Tournées extraites
- ✅ `tct_history` - Historique des actions

## Fonctionnalités ajoutées

### Trigger automatique
Quand un utilisateur s'inscrit via Supabase Auth, un profil est **automatiquement créé** dans la table `users` avec:
- UUID de auth.users
- numDome (du formulaire d'inscription)
- employeeId (du formulaire)
- email
- telephone
- role (admin ou driver)
- is_admin (boolean)

### Sécurité (RLS)
- Chaque utilisateur ne voit que ses propres données
- Les admins peuvent voir tous les profils
- Toutes les tournées et documents sont protégés par utilisateur

## Prochaines étapes

1. ✅ Exécuter Script 1 (tables TCT)
2. ✅ Exécuter Script 2 (table users + trigger)
3. ✅ Vérifier les tables dans Table Editor
4. 🚀 Tester l'inscription d'un nouvel utilisateur
5. 🚀 Vérifier que le profil est créé automatiquement

Votre application est maintenant prête!
