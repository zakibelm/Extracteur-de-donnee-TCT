import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const createTables = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is missing');
    }

    const sql = neon(process.env.DATABASE_URL);

    console.log('⏳ Creating tables...');

    try {
        // Create users table
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id serial PRIMARY KEY NOT NULL,
                num_dome text NOT NULL,
                id_employe text NOT NULL,
                telephone text,
                is_admin boolean DEFAULT false NOT NULL,
                created_at timestamp DEFAULT now() NOT NULL,
                CONSTRAINT users_num_dome_unique UNIQUE(num_dome)
            )
        `;

        // Create extractions table
        await sql`
            CREATE TABLE IF NOT EXISTS extractions (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                user_dome text NOT NULL,
                section text NOT NULL,
                file_name text NOT NULL,
                status text NOT NULL,
                content jsonb,
                created_at timestamp DEFAULT now() NOT NULL
            )
        `;

        console.log('✅ Tables created successfully!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Failed to create tables:', e);
        process.exit(1);
    }
};

createTables();
