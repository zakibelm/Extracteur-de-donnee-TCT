import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: 'DATABASE_URL is missing' });
    }

    const sql = neon(process.env.DATABASE_URL);
    console.log('Creating tables...');

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

    console.log('Tables created successfully!');
    return res.status(200).json({ success: true, message: 'Tables created successfully' });
  } catch (error) {
    console.error('Error creating tables:', error);
    return res.status(500).json({ error: 'Failed to create tables', details: error instanceof Error ? error.message : String(error) });
  }
}
