import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { FinalDocumentView } from './FinalDocumentView';
import { TCT_HEADERS,TCT_DISPATCH_HEADERS } from '../utils/table';
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

it('filters the actual vehicle of a 16-column table and resets filters on document change',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const row=(id:string,employee:string,vehicle:string)=>['TCT'+id,'Transporteur','7:06','8:03','TAXI',employee,'Exemple',employee,vehicle,'TAXI','','Oui','Non','','Départ','Fin'];
 const props={onPrint:vi.fn(),onDownloadPdf:vi.fn(),onTableUpdate:vi.fn(),user:{id:'owner',numDome:'QA',isAdmin:true} as never};
 await act(async()=>{root.render(<FinalDocumentView {...props} tableData={{headers:[...TCT_DISPATCH_HEADERS],rows:[row('0033','0536','430'),row('0019','0128','128')]}}/>);});
 const filter=host.querySelector('[aria-label="Filtrer les véhicules"]') as HTMLInputElement;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(filter,'430');filter.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(host.querySelectorAll('tbody tr')).toHaveLength(1);expect(host.querySelector('tbody')?.textContent).toContain('0536');expect(host.querySelector('tbody')?.textContent).not.toContain('0128');
 await act(async()=>{root.render(<FinalDocumentView {...props} tableData={{headers:[...TCT_DISPATCH_HEADERS],rows:[row('0004','0999','999')]}}/>);});
 expect(filter.value).toBe('');expect(host.querySelector('tbody')?.textContent).toContain('0999');
 act(()=>root.unmount());host.remove();
});
