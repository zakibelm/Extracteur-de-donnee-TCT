import { expect, it } from 'vitest';
import { requireAdmin, requireAdminRole } from './auth';
import type { VercelRequest } from '@vercel/node';
it('refuses calls without a bearer session before any network request', async () => {
    await expect(requireAdmin({ headers: {} } as VercelRequest)).rejects.toMatchObject({ status: 401 });
});
it('refuses driver roles', () => {
    expect(() => requireAdminRole({ app_metadata: { role: 'driver' } })).toThrow();
    expect(() => requireAdminRole({})).toThrow();
    expect(() => requireAdminRole({ app_metadata: { role: 'admin' } })).not.toThrow();
});
