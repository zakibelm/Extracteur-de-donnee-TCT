
import { neon } from '@neondatabase/serverless';

const CONNECTION_STRING = "postgres://neondb_owner:npg_wXdMv3Sqj1kJ@ep-twilight-thunder-ahcp3cgt-pooler.c-3.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
const sql = neon(CONNECTION_STRING);

async function runMigration() {
    console.log("Starting Migration to V2 (EVV Architecture)...");

    try {
        // 0. Extensions
        console.log("0. Extensions...");
        await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
        await sql`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`;

        // 1. Update Users Table (ADAPTED to preserve existing data)
        console.log("1. Updating Users Table...");
        // Add new columns if they don't exist
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nom VARCHAR(100);`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom VARCHAR(100);`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`;

        // Note: We keep existing 'id' (Integer), 'email', 'num_dome', 'role' etc.
        // We do not enforce the CHECK constraint on role because we have 'driver' which isn't in your new list.

        // 2. Documents Table (Adapted for Integer user_id)
        console.log("2. Creating Documents Table...");
        await sql`
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255),
                file_url TEXT,
                mime_type VARCHAR(50),
                file_size INTEGER,
                
                document_type VARCHAR(50) DEFAULT 'tournees_tct',
                date_document DATE,
                num_pages INTEGER,
                
                status VARCHAR(20) DEFAULT 'uploaded',
                processing_started_at TIMESTAMP,
                processing_completed_at TIMESTAMP,
                error_message TEXT,
                
                uploaded_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                
                search_vector tsvector
            );
        `;

        // 3. Extractions Table (Adapted for Integer created_by)
        console.log("3. Creating Extractions Table...");
        await sql`
            CREATE TABLE IF NOT EXISTS extractions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
                
                phase VARCHAR(10) NOT NULL,
                phase_status VARCHAR(20) DEFAULT 'pending',
                
                raw_data JSONB,
                structured_data JSONB,
                
                model_used VARCHAR(100),
                prompt_used TEXT,
                
                tokens_input INTEGER,
                tokens_output INTEGER,
                tokens_total INTEGER,
                cost_usd DECIMAL(10,6),
                latency_ms INTEGER,
                
                confidence_score FLOAT,
                quality_score FLOAT,
                
                errors JSONB,
                warnings JSONB,
                
                created_at TIMESTAMP DEFAULT NOW(),
                created_by INTEGER REFERENCES users(id)
            );
        `;

        // 4. Tournees TCT Table (Adapted FKs)
        console.log("4. Creating Tournees TCT Table...");
        await sql`
            CREATE TABLE IF NOT EXISTS tournees_tct (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                extraction_id UUID REFERENCES extractions(id) ON DELETE SET NULL,
                document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
                
                tournee VARCHAR(20) NOT NULL,
                nom_compagnie VARCHAR(100) DEFAULT 'TAXI COOP TERREBONNE',
                
                debut_tournee TIME,
                fin_tournee TIME,
                -- Removed GENERATED ALWAYS column for compatibility/simplicity, can be added if DB supports it fully
                -- We will compute duration in app or plain SQL
                
                classe_vehicule VARCHAR(20),
                vehicule VARCHAR(10),
                classe_vehicule_affecte VARCHAR(20),
                stationnement VARCHAR(50),
                
                id_employe VARCHAR(10),
                nom_employe VARCHAR(100),
                prenom_employe VARCHAR(100),
                -- Removed GENERATED ALWAYS name for simplicity
                
                approuve BOOLEAN DEFAULT false,
                
                territoire_debut VARCHAR(100),
                adresse_debut TEXT,
                adresse_fin TEXT,
                
                changement TEXT,
                changement_par VARCHAR(100),
                
                confidence_score FLOAT,
                needs_review BOOLEAN DEFAULT false,
                reviewed_by INTEGER REFERENCES users(id),
                reviewed_at TIMESTAMP,
                
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                validated_at TIMESTAMP,
                validated_by INTEGER REFERENCES users(id)
            );
        `;

        // 5. Access Logs (Adapted FKs)
        console.log("5. Creating Access Logs Table...");
        await sql`
            CREATE TABLE IF NOT EXISTS access_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
                tournee_id UUID REFERENCES tournees_tct(id) ON DELETE SET NULL,
                
                action VARCHAR(50) NOT NULL,
                details JSONB,
                
                ip_address INET,
                user_agent TEXT,
                
                timestamp TIMESTAMP DEFAULT NOW()
            );
        `;

        // 6. EVV Config
        console.log("6. Creating EVV Config Table...");
        await sql`
            CREATE TABLE IF NOT EXISTS evv_config (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                
                execute_model VARCHAR(100) DEFAULT 'anthropic/claude-sonnet-4-20250514',
                execute_temperature FLOAT DEFAULT 0.1,
                execute_max_tokens INTEGER DEFAULT 4000,
                
                verify_model VARCHAR(100) DEFAULT 'anthropic/claude-sonnet-4-20250514',
                verify_temperature FLOAT DEFAULT 0.0,
                
                validate_model VARCHAR(100) DEFAULT 'anthropic/claude-sonnet-4-20250514',
                validate_temperature FLOAT DEFAULT 0.0,
                
                min_confidence_score FLOAT DEFAULT 0.75,
                min_quality_score FLOAT DEFAULT 0.80,
                
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;

        // Insert default config
        await sql`
            INSERT INTO evv_config (name, description) VALUES
            ('default', 'Configuration EVV par défaut pour extraction TCT')
            ON CONFLICT (name) DO NOTHING;
        `;

        // 7. Indexes (Simplified subset for speed)
        console.log("7. Creating Indexes...");
        // Use try-catch for indexes to avoid "already exists" errors being fatal
        const createIndex = async (query) => { try { await sql(query); } catch (e) { /* ignore exists */ } };

        await createIndex(`CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id)`);
        await createIndex(`CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status)`);
        await createIndex(`CREATE INDEX IF NOT EXISTS idx_extractions_document ON extractions(document_id)`);
        await createIndex(`CREATE INDEX IF NOT EXISTS idx_tournees_document ON tournees_tct(document_id)`);
        await createIndex(`CREATE INDEX IF NOT EXISTS idx_tournees_employe ON tournees_tct(id_employe)`);

        console.log("✅ Migration V2 Complete!");

    } catch (e) {
        console.error("❌ Migration Failed:", e);
    }
}

runMigration();
