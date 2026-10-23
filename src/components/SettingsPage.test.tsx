import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/supabaseClient', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
import { SettingsPage } from './SettingsPage';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
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
