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
