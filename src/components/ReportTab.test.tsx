import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ReportTab } from './ReportTab';
const change = (time: string) => ({ headers: ['Véhicule'], row: ['203'], old_vehicle: '430', new_vehicle: '203', user_id: 'owner', user_dome: '203', changed_at: time });
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T12:00:00Z'));
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
it('counts each new modification, clears on consultation, and restores the consultation after remount', async () => {
    const oldChanges = [change('2026-10-24T10:00:00Z'), change('2026-10-24T11:00:00Z')];
    const render = async (active: boolean, changes = oldChanges, userId = 'owner') => {
        await act(async () => { root.render(<ReportTab key={userId} userId={userId} changes={changes} active={active} disabled={false} onOpen={vi.fn()} />); });
    };
    await render(false);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('2');
    await render(true);
    expect(host.querySelector('[role="status"]')).toBeNull();
    await act(async () => root.render(<div />));
    await render(false);
    expect(host.querySelector('[role="status"]')).toBeNull();
    const updated = [...oldChanges, change('2026-10-24T13:00:00Z')];
    await render(false, updated);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('1');
    await render(false, updated, 'another-account');
    expect(host.querySelector('[role="status"]')?.textContent).toBe('3');
    await render(false, updated, 'owner');
    expect(host.querySelector('[role="status"]')?.textContent).toBe('1');
});
it('does not acknowledge a disabled report and calls the report navigation when opened', async () => {
    const onOpen = vi.fn();
    const props = { userId: 'owner', changes: [change('2026-10-24T10:00:00Z')], active: true, disabled: true, onOpen };
    await act(async () => root.render(<ReportTab {...props} />));
    expect(localStorage.getItem('adt_report_last_seen_v1:owner')).toBeNull();
    await act(async () => root.render(<ReportTab {...props} active={false} disabled={false} />));
    expect(host.querySelector('[role="status"]')?.textContent).toBe('1');
    await act(async () => host.querySelector('button')!.click());
    expect(onOpen).toHaveBeenCalledOnce();
});
