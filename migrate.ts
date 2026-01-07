
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import * as schema from './src/db/schema';

const runMigration = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is missing');
    }

    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql, { schema });

    console.log('⏳ Running migrations...');

    // Note: for neon-http, we usually need "drizzle-orm/neon-http/migrator"
    // ensuring "drizzle" folder exists with meta.
    // If we only have schema, push:pg is used. 
    // BUT since push:pg is stuck, we probably want to Generate first then Migrate.

    // Let's assume we generated migrations to ./drizzle
    try {
        await migrate(db, { migrationsFolder: 'drizzle' });
        console.log('✅ Migrations completed!');
    } catch (e) {
        console.error('❌ Migration failed:', e);
    }
};

runMigration();
