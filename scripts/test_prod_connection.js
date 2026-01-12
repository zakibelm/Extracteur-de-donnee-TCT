
import { neon } from '@neondatabase/serverless';

// The exact URL we asked the user to put in Vercel
const CONNECTION_STRING = "postgres://neondb_owner:npg_wXdMv3Sqj1kJ@ep-twilight-thunder-ahcp3cgt-pooler.c-3.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

async function testConnection() {
    console.log("Testing connection with: " + CONNECTION_STRING.replace(/:[^:@]*@/, ':****@'));
    try {
        const sql = neon(CONNECTION_STRING);
        const result = await sql`SELECT version()`;
        console.log("Connection SUCCESS!");
        console.log("Version:", result[0].version);
    } catch (e) {
        console.error("Connection FAILED:", e.message);
    }
}

testConnection();
