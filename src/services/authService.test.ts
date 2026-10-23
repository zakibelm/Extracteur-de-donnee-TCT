import { it, expect, vi } from 'vitest';
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
import { toAppUser } from './authService';
import type { User } from '@supabase/supabase-js';
it('never accepts admin privileges from editable user metadata', () => {
    const user = { id: 'uuid', user_metadata: { role: 'admin' }, app_metadata: {} } as unknown as User;
    expect(toAppUser(user).isAdmin).toBe(false);
    expect(toAppUser(user).role).toBe('driver');
});
it('accepts privileges from protected app metadata', () => {
    const user = { id: 'uuid', user_metadata: {}, app_metadata: { role: 'admin' } } as unknown as User;
    expect(toAppUser(user).isAdmin).toBe(true);
    expect(toAppUser(user).id).toBe('uuid');
});
