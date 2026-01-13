
import { neon } from '@neondatabase/serverless';

const CONNECTION_STRING = "postgres://neondb_owner:npg_wXdMv3Sqj1kJ@ep-twilight-thunder-ahcp3cgt-pooler.c-3.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
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
