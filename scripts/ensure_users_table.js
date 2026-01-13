
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgres://neondb_owner:npg_wXdMv3Sqj1kJ@ep-twilight-thunder-ahcp3cgt-pooler.c-3.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
const sql = neon(DATABASE_URL);

async function ensureSchema() {
    try {
        console.log('Ensuring users table schema (Attempt 2)...');

        // 1. Create table if not exists
        await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        num_dome VARCHAR(255),
        employee_id VARCHAR(255),
        email VARCHAR(255),
        password_hash TEXT,
        role VARCHAR(50),
        telephone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
        console.log('Table users verified/created.');

        // 2. Add columns manually to avoid string interpolation issues in tagged templates for identifiers
        // Neon driver doesn't support dyamic identifiers easily in tagged templates without helper.
        // We will just execute specific ALTER statements hardcoded since we know the columns.

        try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS num_dome VARCHAR(255)`; console.log('Checked num_dome'); } catch (e) { }
        try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255)`; console.log('Checked employee_id'); } catch (e) { }
        try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`; console.log('Checked email'); } catch (e) { }
        try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`; console.log('Checked password_hash'); } catch (e) { }
        try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50)`; console.log('Checked role'); } catch (e) { }
        try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS telephone VARCHAR(50)`; console.log('Checked telephone'); } catch (e) { }

        // 3. Add Unique Constraints
        // Same strategy: explicit calls.

        try {
            await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_num_dome ON users (num_dome)`;
            console.log('Index for num_dome ensured');
        } catch (e) { console.log('Index num_dome error', e.message) }

        try {
            await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id ON users (employee_id)`;
            console.log('Index for employee_id ensured');
        } catch (e) { console.log('Index employee_id error', e.message) }

        try {
            await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email)`;
            console.log('Index for email ensured');
        } catch (e) { console.log('Index email error', e.message) }

        // Also try adding CONSTRAINT UNIQUE directly if indices aren't enough for logical constraints, 
        // but unique indexes act as unique constraints in Postgres. 
        // Let's try to ADD CONSTRAINT, catching "already exists".

        try { await sql`ALTER TABLE users ADD CONSTRAINT users_num_dome_unique UNIQUE (num_dome)`; } catch (e) { }
        try { await sql`ALTER TABLE users ADD CONSTRAINT users_employee_id_unique UNIQUE (employee_id)`; } catch (e) { }
        try { await sql`ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)`; } catch (e) { }

        console.log('Schema verification complete.');

    } catch (error) {
        console.error('Schema verification failed:', error);
    }
}

ensureSchema();
