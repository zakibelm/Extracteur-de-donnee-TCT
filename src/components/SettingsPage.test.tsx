import { supabase } from '../lib/supabaseClient';
import { getExtractionKey, setExtractionKey } from '../services/extractionSettings';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/supabaseClient', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
import { SettingsPage } from './SettingsPage';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    setExtractionKey(''); localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it('replaces a retired saved model with a live vision model and saves it', async () => {
    localStorage.setItem('adt_settings_model', 'retired/model');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [{ id: 'test/current', name: 'Current Vision' }] }))));
    await act(async () => { root.render(<SettingsPage />); });
    expect(host.querySelector('select')?.value).toBe('test/current');
    expect(host.textContent).toContain('ancien modèle');
    const save = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Sauvegarder'))!;
    act(() => save.click());
    expect(localStorage.getItem('adt_settings_model')).toBe('test/current');
    expect(host.querySelector('option')?.textContent).toBe('Current Vision');
});
it('disables saving and testing when the catalog cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Catalogue indisponible' }), { status: 503 })));
    await act(async () => { root.render(<SettingsPage />); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Catalogue indisponible');
    expect([...host.querySelectorAll('button')].find(b => b.textContent?.includes('Sauvegarder'))?.disabled).toBe(true);
});

it('activates the tested key/model immediately without an additional save click', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'session-token' } } } as never);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url === '/api/models' ?
        { models: [{ id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini' }] } : { ok: true }))));
    await act(async () => { root.render(<SettingsPage />); });
    const input = host.querySelector('input[type="password"]') as HTMLInputElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'test-key');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const test = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Tester'))!;
    await act(async () => { test.click(); });
    expect(getExtractionKey()).toBe('test-key');
    expect(localStorage.getItem('adt_settings_model')).toBe('openai/gpt-4.1-mini');
    expect(host.textContent).toContain('activés');
});

it('keeps a typed key active when leaving settings without clicking Save or Test', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [{ id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini' }] }))));
    await act(async () => { root.render(<SettingsPage />); });
    const input = host.querySelector('input[type="password"]') as HTMLInputElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'key-for-this-tab');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(getExtractionKey()).toBe('key-for-this-tab');
    act(() => root.render(<div>Extraction</div>));
    expect(getExtractionKey()).toBe('key-for-this-tab');
    expect(localStorage.getItem('adt_settings_apikey')).toBeNull();
});
