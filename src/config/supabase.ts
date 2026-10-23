// Public project configuration. No service-role key or password belongs here.
export const PROJECT_URL = 'https://csypcxkpipafxrjaborn.supabase.co';
export const PROJECT_PUBLISHABLE_KEY = 'sb_publishable_C5bc98EYLigfq9_UsXWzBw_qk5QNyfi';

// Identifies the requested account only; Supabase still verifies its password and role.
export function resolveLoginIdentifier(identifier: string): string {
    const trimmed = identifier.trim();
    return trimmed === '203' ? 'zakibelm66@gmail.com' : trimmed;
}
