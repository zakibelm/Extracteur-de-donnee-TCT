-- Script SQL pour créer les Data Tables TCT dans PostgreSQL (Neon)

-- Table pour les documents TCT
CREATE TABLE IF NOT EXISTS tct_documents (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_url TEXT,
    upload_date TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    user_id VARCHAR(50) NOT NULL,
    extracted_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide par utilisateur
CREATE INDEX IF NOT EXISTS idx_tct_documents_user_id ON tct_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_tct_documents_upload_date ON tct_documents(upload_date DESC);

-- Table pour les tournées extraites
CREATE TABLE IF NOT EXISTS tct_tournees (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES tct_documents(id) ON DELETE CASCADE,
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
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide par document
CREATE INDEX IF NOT EXISTS idx_tct_tournees_document_id ON tct_tournees(document_id);
CREATE INDEX IF NOT EXISTS idx_tct_tournees_tournee ON tct_tournees(tournee);

-- Table pour l'historique des actions
CREATE TABLE IF NOT EXISTS tct_history (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES tct_documents(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
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

COMMENT ON TABLE tct_documents IS 'Stocke les métadonnées des documents TCT uploadés';
COMMENT ON TABLE tct_tournees IS 'Stocke les tournées extraites des documents TCT';
COMMENT ON TABLE tct_history IS 'Historique des actions et événements liés aux extractions';
