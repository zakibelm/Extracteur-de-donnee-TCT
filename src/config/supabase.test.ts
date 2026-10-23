import { expect, it } from 'vitest';
import { resolveLoginIdentifier } from './supabase';
it('resolves 203 without bypassing authentication', () => {
    expect(resolveLoginIdentifier(' 203 ')).toBe('zakibelm66@gmail.com');
    expect(resolveLoginIdentifier('other@example.test')).toBe('other@example.test');
    expect(resolveLoginIdentifier('999')).toBe('999');
});
