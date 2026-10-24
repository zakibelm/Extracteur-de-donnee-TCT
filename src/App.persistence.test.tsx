import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }));
vi.mock('./services/authService', () => ({ authService: {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'owner', isAdmin: true, numDome: 'QA', idEmploye: '', email: 'qa@example.test', role: 'admin' }),
    onAuthStateChange: () => ({ unsubscribe: vi.fn() }),
} }));
vi.mock('./utils/prepareImage', () => ({ prepareImage: vi.fn().mockResolvedValue({ base64: 'YWJj', mimeType: 'image/png' }) }));
vi.mock('./services/n8n', () => ({ extractDocumentViaN8n: vi.fn() }));
vi.mock('./services/supabaseService', () => ({ saveExtractionToSupabase: vi.fn(), getSavedExtraction: vi.fn() }));
vi.mock('./components/Sidebar', () => ({ Sidebar: (props: any) => <div>
    <button onClick={() => props.onTctFileChange([new File(['abc'], 'scan.png', { type: 'image/png' })])}>Importer QA</button>
    <button onClick={props.onTctExtractData}>Analyser QA</button>
</div> }));
vi.mock('./components/MainContent', () => ({ MainContent: (props: any) => <div>
    <p>{props.tctSaveStatus}</p><p>{props.tctSaveMessage}</p><p>{props.tctUnifiedTable?.rows.length || 0} lignes affichées</p>
    <button onClick={props.onTctGenerateResults}>Réessayer QA</button>
</div> }));
import { App } from './App';
import { extractDocumentViaN8n } from './services/n8n';
import { saveExtractionToSupabase } from './services/supabaseService';
import { TCT_HEADERS } from './utils/table';
let host: HTMLDivElement; let root: Root;
const click = async (label: string) => { await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent === label)!.click(); }); };
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.mocked(extractDocumentViaN8n).mockResolvedValue({ headers: [...TCT_HEADERS], rows: [TCT_HEADERS.map(() => '0458')] });
    vi.mocked(saveExtractionToSupabase).mockResolvedValue({ success: true, documentId: 42, tourneesCount: 1, executionTime: 0 });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('automatically saves a complete scan without requiring the final-document button', async () => {
    await act(async () => { root.render(<App />); });
    await click('Importer QA'); await click('Analyser QA');
    expect(saveExtractionToSupabase).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('saved');
    expect(host.textContent).toContain('Document nº 42');
});
it('retains the table on save failure and retries with the same idempotency key', async () => {
    vi.mocked(saveExtractionToSupabase).mockRejectedValueOnce(new Error('offline'));
    await act(async () => { root.render(<App />); });
    await click('Importer QA'); await click('Analyser QA');
    expect(host.textContent).toContain('Non enregistré');
    expect(host.textContent).toContain('1 lignes affichées');
    const requestId = vi.mocked(saveExtractionToSupabase).mock.calls[0][0].request_id;
    await click('Réessayer QA');
    expect(vi.mocked(saveExtractionToSupabase).mock.calls[1][0].request_id).toBe(requestId);
    expect(host.textContent).toContain('saved');
});

it('does not archive an incomplete extraction as a successful document', async () => {
    vi.mocked(extractDocumentViaN8n).mockRejectedValueOnce(new Error('model unavailable'));
    await act(async () => { root.render(<App />); });
    await click('Importer QA'); await click('Analyser QA');
    expect(saveExtractionToSupabase).not.toHaveBeenCalled();
    expect(host.textContent).toContain('0 lignes affichées');
});
