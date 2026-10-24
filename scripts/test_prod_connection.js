
import { neon } from '@neondatabase/serverless';

// The exact URL we asked the user to put in Vercel
const CONNECTION_STRING = process.env.DATABASE_URL;
if (!CONNECTION_STRING) throw new Error('DATABASE_URL doit être définie dans l’environnement.');

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
