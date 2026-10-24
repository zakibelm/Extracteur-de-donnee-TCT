import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { FinalDocumentView } from './FinalDocumentView';
import { TCT_HEADERS } from '../utils/table';
it('labels all 14 columns and preserves metadata when a vehicle correction is confirmed', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    const update = vi.fn();
    const rows = [TCT_HEADERS.map((_, index) => index === 0 ? 'TCT0004' : index === 7 ? '212' : '')];
    const table = { headers: [...TCT_HEADERS], rows, metadata: { schedule_date: '2026-10-24' } };
    await act(async () => { root.render(<FinalDocumentView tableData={table} onPrint={vi.fn()} onDownloadPdf={vi.fn()} onTableUpdate={update} user={{ id: 'owner', numDome: 'QA', isAdmin: true } as never} />); });
    expect(host.querySelectorAll('th[scope="col"]')).toHaveLength(14);
    const input = host.querySelector('[aria-label="Véhicule pour TCT0004"]') as HTMLInputElement;
    await act(async () => { input.focus(); });
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '203');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { input.blur(); });
    expect(update).not.toHaveBeenCalled();
    await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Valider le changement'))!.click(); });
    expect(update.mock.calls[0][0].rows[0][7]).toBe('203');
    expect(update.mock.calls[0][0].metadata.schedule_date).toBe('2026-10-24');
    act(() => root.unmount()); host.remove();
});
