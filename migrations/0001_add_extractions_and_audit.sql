-- Migration: Ajout des tables extractions et audit_logs
-- Date: 2026-01-14
-- Description: Complète le schéma avec les tables manquantes et les index

-- ========================================
-- Modifications de la table users
-- ========================================

-- Ajout des colonnes manquantes à la table users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Ajout des contraintes uniques
ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS users_id_employe_unique UNIQUE (id_employe),
ADD CONSTRAINT IF NOT EXISTS users_email_unique UNIQUE (email);

-- Ajout des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_id_employe ON users(id_employe);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ========================================
-- Création de la table extractions
-- ========================================

CREATE TABLE IF NOT EXISTS extractions (
    id SERIAL PRIMARY KEY,

    -- Relations
    user_id VARCHAR(50) NOT NULL REFERENCES users(num_dome) ON DELETE CASCADE,

    -- Métadonnées fichier
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,

    -- Données extraites (JSON)
    extracted_data JSONB NOT NULL,

    -- Statut
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,

    -- Modèle IA utilisé
    ai_model VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    processed_at TIMESTAMP
);

-- Index pour la table extractions
CREATE INDEX IF NOT EXISTS idx_extractions_user_id ON extractions(user_id);
CREATE INDEX IF NOT EXISTS idx_extractions_status ON extractions(status);
CREATE INDEX IF NOT EXISTS idx_extractions_created_at ON extractions(created_at);
CREATE INDEX IF NOT EXISTS idx_extractions_user_status ON extractions(user_id, status);

-- ========================================
-- Création de la table audit_logs
-- ========================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,

    -- Utilisateur (peut être NULL si l'utilisateur est supprimé)
    user_id VARCHAR(50) REFERENCES users(num_dome) ON DELETE SET NULL,

    -- Type d'action
    action VARCHAR(50) NOT NULL,

    -- Détails (JSON)
    details JSONB,

    -- Métadonnées
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index pour la table audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ========================================
-- Trigger pour updated_at automatique
-- ========================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour extractions
DROP TRIGGER IF EXISTS update_extractions_updated_at ON extractions;
CREATE TRIGGER update_extractions_updated_at
    BEFORE UPDATE ON extractions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Fonction utilitaire pour l'audit
-- ========================================

CREATE OR REPLACE FUNCTION log_audit(
    p_user_id VARCHAR(50),
    p_action VARCHAR(50),
    p_details JSONB DEFAULT NULL,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    new_id INTEGER;
BEGIN
    INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent)
    VALUES (p_user_id, p_action, p_details, p_ip_address, p_user_agent)
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Données de test (optionnel)
-- ========================================

-- Insertion d'un utilisateur de test si la table est vide
INSERT INTO users (num_dome, id_employe, telephone, email, is_admin, created_at, updated_at)
VALUES ('402', '919', '514-123-4567', 'test@adt.com', true, NOW(), NOW())
ON CONFLICT (num_dome) DO NOTHING;

-- Commentaires pour documentation
COMMENT ON TABLE extractions IS 'Stocke les extractions de données effectuées par les utilisateurs';
COMMENT ON TABLE audit_logs IS 'Journal d\'audit de toutes les actions dans l\'application';
COMMENT ON COLUMN extractions.extracted_data IS 'Données extraites au format JSON {headers: [], rows: [[]]}';
COMMENT ON COLUMN audit_logs.details IS 'Détails de l\'action au format JSON';
