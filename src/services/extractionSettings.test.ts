import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { getExtractionModel, bindExtractionOwner, setExtractionKey, getExtractionKey, persistExtractionKey, forgetExtractionKey } from './extractionSettings';
it('migrates every previously selected unsupported model to the application default', () => {
    for (const id of ['preview/vision', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini']) {
        localStorage.setItem('adt_settings_model', id);
        expect(getExtractionModel()).toBe('openai/gpt-4.1-mini');
        expect(localStorage.getItem('adt_settings_model')).toBe('openai/gpt-4.1-mini');
    }
});

beforeEach(() => { bindExtractionOwner(null); localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); bindExtractionOwner(null); });
it('restores a saved key after a refresh-equivalent account rebind and isolates accounts', () => {
    bindExtractionOwner('account-a'); setExtractionKey('key-a'); persistExtractionKey();
    bindExtractionOwner(null); expect(getExtractionKey()).toBe('');
    bindExtractionOwner('account-b'); expect(getExtractionKey()).toBe('');
    setExtractionKey('key-b'); persistExtractionKey();
    bindExtractionOwner('account-a'); expect(getExtractionKey()).toBe('key-a');
    forgetExtractionKey(); bindExtractionOwner(null); bindExtractionOwner('account-a'); expect(getExtractionKey()).toBe('');
    bindExtractionOwner('account-b'); expect(getExtractionKey()).toBe('key-b');
});
it('does not persist merely typed keys without an explicit Save', () => {
    bindExtractionOwner('account-a'); setExtractionKey('temporary');
    bindExtractionOwner(null); bindExtractionOwner('account-a');
    expect(getExtractionKey()).toBe('');
});
it('reports blocked browser storage instead of claiming that a key was saved', () => {
    bindExtractionOwner('account-a'); setExtractionKey('temporary');
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => persistExtractionKey()).toThrow('refuse la mémorisation');
});
