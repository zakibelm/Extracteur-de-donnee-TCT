-- ============================================================================
-- MIGRATION: Ancienne structure -> Structure Réelle TCT
-- ============================================================================

ALTER TABLE tournees_tct ADD COLUMN IF NOT EXISTS id_employe_confirm VARCHAR(10);
ALTER TABLE tournees_tct ADD COLUMN IF NOT EXISTS nom_employe_complet VARCHAR(200);
ALTER TABLE tournees_tct ADD COLUMN IF NOT EXISTS autorisation VARCHAR(50);
ALTER TABLE tournees_tct ADD COLUMN IF NOT EXISTS retour BOOLEAN DEFAULT false;
ALTER TABLE tournees_tct ADD COLUMN IF NOT EXISTS changement VARCHAR(20);
ALTER TABLE tournees_tct ADD COLUMN IF NOT EXISTS changement_par VARCHAR(20);
ALTER TABLE tournees_tct ADD COLUMN IF NOT EXISTS id_employe_mismatch BOOLEAN DEFAULT false;
ALTER TABLE tournees_tct ADD COLUMN IF NOT EXISTS nom_separe BOOLEAN DEFAULT false;

-- Reconstruire nom_employe_complet depuis nom/prénom si existants
UPDATE tournees_tct 
SET nom_employe_complet = 
    CASE 
        WHEN nom_employe IS NOT NULL AND prenom_employe IS NOT NULL 
        THEN nom_employe || ', ' || prenom_employe
        WHEN nom_employe IS NOT NULL 
        THEN nom_employe
        ELSE NULL
    END,
    nom_separe = true
WHERE nom_employe_complet IS NULL 
  AND (nom_employe IS NOT NULL OR prenom_employe IS NOT NULL);

-- Copier id_employe dans id_employe_confirm
UPDATE tournees_tct 
SET id_employe_confirm = id_employe
WHERE id_employe_confirm IS NULL AND id_employe IS NOT NULL;

-- Recréer colonnes calculées
ALTER TABLE tournees_tct DROP COLUMN IF EXISTS nom_complet_employe CASCADE;
ALTER TABLE tournees_tct ADD COLUMN nom_complet_employe VARCHAR(200) 
GENERATED ALWAYS AS (
    CASE 
        WHEN prenom_employe IS NOT NULL AND nom_employe IS NOT NULL 
        THEN prenom_employe || ' ' || nom_employe
        ELSE nom_employe_complet
    END
) STORED;

SELECT '✅ Migration terminée avec succès!' as status;
