
import { neon } from '@neondatabase/serverless';

const CONNECTION_STRING = process.env.DATABASE_URL;
if (!CONNECTION_STRING) throw new Error('DATABASE_URL doit être définie dans l’environnement.');
const sql = neon(CONNECTION_STRING);

async function checkColumns() {
    try {
        const columns = await sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'users';
        `;
        console.log("Columns in 'users' table:");
        console.table(columns);
    } catch (e) {
        console.error("Error:", e);
    }
}

checkColumns();
