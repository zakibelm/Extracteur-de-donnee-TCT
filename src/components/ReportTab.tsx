import React, { useEffect, useState } from 'react';
import { VehicleChange } from '../types';
import { Icons } from './Icons';

interface Props {
    userId: string;
    changes: VehicleChange[];
    active: boolean;
    disabled: boolean;
    onOpen: () => void;
}

// Consultation is remembered for this account in this browser, separately from document saves.
export const ReportTab: React.FC<Props> = ({ userId, changes, active, disabled, onOpen }) => {
    const storageKey = 'adt_report_last_seen_v1:' + userId;
    const [lastSeen, setLastSeen] = useState(() => {
        try { const value = Number(localStorage.getItem(storageKey)); return Number.isFinite(value) ? value : 0; }
        catch { return 0; }
    });
    const latestChange = changes.reduce((latest, change) => Math.max(latest, Date.parse(change.changed_at) || 0), 0);
    const unread = active ? 0 : changes.filter(change => Date.parse(change.changed_at) > lastSeen).length;
    useEffect(() => {
        if (!active || disabled) return;
        const seenAt = Math.max(Date.now(), latestChange);
        setLastSeen(seenAt);
        try { localStorage.setItem(storageKey, String(seenAt)); }
        catch { /* Keep the consultation state in memory when storage is unavailable. */ }
    }, [active, disabled, latestChange, storageKey]);

    return <button
        onClick={onOpen}
        disabled={disabled}
        aria-label={unread ? `Rapport, ${unread} nouvelle${unread > 1 ? 's' : ''} modification${unread > 1 ? 's' : ''}` : 'Rapport'}
        className={`px-3 py-2 font-medium text-xs rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${active ? 'border-b-2 border-amber-400 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
    >
        <Icons.ClipboardList className="inline-block mr-1.5 w-4 h-4" />
        Rapport
        {unread > 0 && <span role="status" aria-live="polite" className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-slate-950">{unread}</span>}
    </button>;
};
