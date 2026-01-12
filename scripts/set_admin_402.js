
import { neon } from '@neondatabase/serverless';

const CONNECTION_STRING = "postgres://neondb_owner:npg_wXdMv3Sqj1kJ@ep-twilight-thunder-ahcp3cgt-pooler.c-3.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
const sql = neon(CONNECTION_STRING);

async function setAdmin() {
    console.log("Updating user 402 to admin...");
    try {
        // Update the role to 'admin' for employee_id '402'
        const result = await sql`
            UPDATE users 
            SET role = 'admin' 
            WHERE id_employe = '402'
            RETURNING id, id_employe, role;
        `;

        if (result.length > 0) {
            console.log("Success! User updated:", result[0]);
        } else {
            console.log("No user found with id_employe = '402'. They might not have signed up yet.");
        }

    } catch (e) {
        console.error("Error updating user:", e);
    }
}

setAdmin();
