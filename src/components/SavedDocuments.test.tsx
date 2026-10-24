import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../services/supabaseService', () => ({ getUserDocuments: vi.fn() }));
import { getUserDocuments } from '../services/supabaseService';
import { SavedDocuments } from './SavedDocuments';
let host: HTMLDivElement; let root: Root;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.resetAllMocks(); });
it('shows persisted documents and opens the chosen document rather than a browser cache', async () => {
    vi.mocked(getUserDocuments).mockResolvedValue([{ id: 42, filename: 'scan.jpg', extracted_count: 41, upload_date: '2026-10-24T12:00:00Z' }] as never);
    const open = vi.fn().mockResolvedValue(undefined);
    await act(async () => { root.render(<SavedDocuments userId="owner" refreshKey={0} onOpen={open} />); });
    expect(host.textContent).toContain('41 lignes');
    expect(host.textContent).toContain('Documents enregistrés (1)');
    await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent === 'Ouvrir')!.click(); });
    expect(open).toHaveBeenCalledWith(42);
});
it('keeps a retrieval failure visible and offers a retry', async () => {
    vi.mocked(getUserDocuments).mockRejectedValue(new Error('offline'));
    await act(async () => { root.render(<SavedDocuments userId="owner" refreshKey={0} onOpen={vi.fn()} />); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Historique indisponible');
    expect(host.textContent).toContain('Actualiser');
});
