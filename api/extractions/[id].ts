import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db';
import { extractions } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Extraction ID is required' });
        }

        // Delete the extraction
        const deleted = await db
            .delete(extractions)
            .where(eq(extractions.id, id))
            .returning();

        if (deleted.length === 0) {
            return res.status(404).json({ error: 'Extraction not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Extraction deleted successfully',
            extraction: deleted[0],
        });
    } catch (error) {
        console.error('Error deleting extraction:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
