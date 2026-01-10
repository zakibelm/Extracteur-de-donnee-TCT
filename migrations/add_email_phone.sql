-- Migration SQL pour ajouter les colonnes email et telephone à la table users
-- À exécuter sur Neon PostgreSQL

-- Ajouter la colonne email si elle n'existe pas
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Ajouter la colonne telephone si elle n'existe pas
ALTER TABLE users ADD COLUMN IF NOT EXISTS telephone VARCHAR(20);

-- Vérifier que les colonnes ont été ajoutées
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('email', 'telephone');
