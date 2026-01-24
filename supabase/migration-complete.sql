-- Migration complète pour Supabase
-- Ce script crée TOUTES les tables nécessaires avec les bons types dès le départ
-- À exécuter dans le SQL Editor de Supabase

-- 1. SUPPRIMER LES ANCIENNES TABLES (si elles existent)
DROP TABLE IF EXISTS tct_history CASCADE;
DROP TABLE IF EXISTS tct_tournees CASCADE;
DROP TABLE IF EXISTS tct_documents CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP VIEW IF EXISTS tct_documents_summary CASCADE;
DROP VIEW IF EXISTS tct_recent_extractions CASCADE;

-- 2. CRÉER LA TABLE USERS (lien avec auth.users)
CREATE TABLE users (
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
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_num_dome ON users(num_dome);
CREATE INDEX idx_users_id_employe ON users(id_employe);
CREATE INDEX idx_users_role ON users(role);

-- 3. CRÉER LA TABLE TCT_DOCUMENTS (avec user_id en UUID)
CREATE TABLE tct_documents (
    id BIGSERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    extracted_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_tct_documents_user_id ON tct_documents(user_id);
CREATE INDEX idx_tct_documents_upload_date ON tct_documents(upload_date DESC);

-- 4. CRÉER LA TABLE TCT_TOURNEES
CREATE TABLE tct_tournees (
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

-- Index pour recherche rapide
CREATE INDEX idx_tct_tournees_document_id ON tct_tournees(document_id);
CREATE INDEX idx_tct_tournees_tournee ON tct_tournees(tournee);

-- 5. CRÉER LA TABLE TCT_HISTORY
CREATE TABLE tct_history (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES tct_documents(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_tct_history_document_id ON tct_history(document_id);
CREATE INDEX idx_tct_history_created_at ON tct_history(created_at DESC);

-- 6. ACTIVER ROW LEVEL SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tct_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tct_tournees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tct_history ENABLE ROW LEVEL SECURITY;

-- 7. POLITIQUES RLS POUR USERS
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON users FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

-- 8. POLITIQUES RLS POUR TCT_DOCUMENTS
CREATE POLICY "Users can view their own documents"
ON tct_documents FOR SELECT
USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own documents"
ON tct_documents FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own documents"
ON tct_documents FOR UPDATE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 9. POLITIQUES RLS POUR TCT_TOURNEES
CREATE POLICY "Users can view tournees of their documents"
ON tct_tournees FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM tct_documents
        WHERE tct_documents.id = tct_tournees.document_id
        AND (tct_documents.user_id = auth.uid() OR auth.role() = 'service_role')
    )
);

CREATE POLICY "Users can insert tournees for their documents"
ON tct_tournees FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tct_documents
        WHERE tct_documents.id = tct_tournees.document_id
        AND (tct_documents.user_id = auth.uid() OR auth.role() = 'service_role')
    )
);

-- 10. POLITIQUES RLS POUR TCT_HISTORY
CREATE POLICY "Users can view history of their documents"
ON tct_history FOR SELECT
USING (
    document_id IS NULL OR
    EXISTS (
        SELECT 1 FROM tct_documents
        WHERE tct_documents.id = tct_history.document_id
        AND (tct_documents.user_id = auth.uid() OR auth.role() = 'service_role')
    )
);

CREATE POLICY "Users can insert history for their documents"
ON tct_history FOR INSERT
WITH CHECK (
    document_id IS NULL OR
    EXISTS (
        SELECT 1 FROM tct_documents
        WHERE tct_documents.id = tct_history.document_id
        AND (tct_documents.user_id = auth.uid() OR auth.role() = 'service_role')
    )
);

-- 11. CRÉER LES VUES
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

-- 12. FONCTIONS ET TRIGGERS

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

-- Triggers pour mettre à jour updated_at
CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_documents_updated_at
    BEFORE UPDATE ON tct_documents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 13. COMMENTAIRES
COMMENT ON TABLE users IS 'Profils utilisateurs étendus liés à auth.users';
COMMENT ON TABLE tct_documents IS 'Stocke les métadonnées des documents TCT uploadés';
COMMENT ON TABLE tct_tournees IS 'Stocke les tournées extraites des documents TCT';
COMMENT ON TABLE tct_history IS 'Historique des actions et événements liés aux extractions';

-- FIN DU SCRIPT
-- Les tables sont maintenant prêtes à être utilisées avec Supabase Auth
