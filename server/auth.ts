import { createClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

// Privileges come only from protected app_metadata on a server-verified user.
export function requireAdminRole(user: { app_metadata?: Record<string, unknown> }): void {
    if (user.app_metadata?.role !== 'admin') throw new HttpError(403, 'Accès réservé à la répartition.');
}

export async function requireAdmin(req: VercelRequest) {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Authentification requise.');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new HttpError(503, 'Authentification serveur non configurée.');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await client.auth.getUser(authorization.slice(7));
    if (error || !user) throw new HttpError(401, 'Session invalide ou expirée.');
    requireAdminRole(user);
    return user;
}
