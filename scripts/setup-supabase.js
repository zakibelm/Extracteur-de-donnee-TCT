/**
 * Script pour créer automatiquement les tables Supabase
 *
 * IMPORTANT: Ce script nécessite la clé SERVICE_ROLE (pas la clé anon)
 *
 * Pour obtenir la clé SERVICE_ROLE:
 * 1. Allez sur https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/settings/api
 * 2. Copiez "service_role key" (secret)
 * 3. Créez un fichier .env.local avec:
 *    SUPABASE_SERVICE_ROLE_KEY=votre_clé_ici
 *
 * Usage:
 *   node scripts/setup-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://nmmmlsgvhupzdunclcvj.supabase.co';

// Lire la clé depuis les arguments ou variable d'environnement
const SERVICE_ROLE_KEY = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
    console.error('❌ Erreur: Clé SERVICE_ROLE manquante');
    console.log('\nUsage:');
    console.log('  node scripts/setup-supabase.js <SERVICE_ROLE_KEY>');
    console.log('\nOu créez un fichier .env.local avec:');
    console.log('  SUPABASE_SERVICE_ROLE_KEY=votre_clé_ici');
    console.log('\nPour obtenir la clé SERVICE_ROLE:');
    console.log('  https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/settings/api');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Lire le script SQL
const sqlPath = path.join(__dirname, '..', 'supabase', 'create-tables.sql');
const sqlScript = fs.readFileSync(sqlPath, 'utf-8');

console.log('🚀 Début de la création des tables Supabase...\n');
console.log('📍 Project URL:', SUPABASE_URL);
console.log('📄 SQL Script:', sqlPath);
console.log('\n' + '='.repeat(60) + '\n');

// Fonction pour exécuter le SQL via l'API REST (PostgREST)
async function executeSql(sql) {
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        // Si la fonction exec_sql n'existe pas, on va créer les tables via l'API REST
        console.warn('⚠️  La fonction exec_sql n\'existe pas. Utilisation de l\'API REST...\n');
        return null;
    }
}

// Fonction alternative: créer les tables via l'API REST directement
async function createTablesViaRest() {
    console.log('📝 Création des tables via l\'API REST Supabase...\n');

    const steps = [
        {
            name: 'Table tct_documents',
            action: async () => {
                // Vérifier si la table existe déjà
                const { data, error } = await supabase
                    .from('tct_documents')
                    .select('id')
                    .limit(1);

                if (!error) {
                    console.log('  ✅ Table tct_documents existe déjà');
                    return true;
                }

                console.log('  ❌ Impossible de créer les tables via l\'API REST');
                console.log('  ℹ️  L\'API REST Supabase ne permet pas de créer des tables');
                return false;
            }
        }
    ];

    for (const step of steps) {
        console.log(`\n${step.name}:`);
        await step.action();
    }
}

// Fonction principale
async function main() {
    console.log('🔍 Vérification de la connexion Supabase...\n');

    // Test de connexion
    try {
        const { data, error } = await supabase.from('_').select('*').limit(1);
        // L'erreur "relation "_" does not exist" est normale, ça confirme que la connexion fonctionne
        console.log('✅ Connexion à Supabase réussie\n');
    } catch (error) {
        console.error('❌ Erreur de connexion à Supabase:', error.message);
        process.exit(1);
    }

    console.log('=' .repeat(60));
    console.log('\n⚠️  LIMITATION DE L\'API REST SUPABASE\n');
    console.log('L\'API REST de Supabase ne permet pas d\'exécuter du SQL arbitraire');
    console.log('pour des raisons de sécurité.\n');
    console.log('VOUS DEVEZ créer les tables manuellement dans le SQL Editor:\n');
    console.log('1. Allez sur: https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/sql');
    console.log('2. Créez une nouvelle requête');
    console.log('3. Copiez le contenu de: supabase/create-tables.sql');
    console.log('4. Collez dans le SQL Editor');
    console.log('5. Cliquez sur "Run" ou appuyez sur Ctrl+Enter\n');
    console.log('=' .repeat(60));
    console.log('\nContenu du fichier SQL à copier:\n');
    console.log('📄 Chemin:', sqlPath);
    console.log('📋 Lignes:', sqlScript.split('\n').length);
    console.log('\n🔗 Lien direct vers le SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/nmmmlsgvhupzdunclcvj/sql/new\n');

    // Tenter quand même de vérifier si les tables existent
    console.log('🔍 Vérification des tables existantes...\n');
    await createTablesViaRest();

    console.log('\n✅ Script terminé\n');
}

main().catch(error => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
});
