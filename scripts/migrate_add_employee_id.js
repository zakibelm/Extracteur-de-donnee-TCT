
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgres://neondb_owner:npg_wXdMv3Sqj1kJ@ep-twilight-thunder-ahcp3cgt-pooler.c-3.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
const sql = neon(DATABASE_URL);

async function runMigration() {
    try {
        console.log('Running migration: Add employee_id to users table...');
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255)`;
        console.log('Migration successful: employee_id column added.');

        // Create an index for faster lookups
        await sql`CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users (employee_id)`;
        console.log('Index created.');

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

runMigration();
