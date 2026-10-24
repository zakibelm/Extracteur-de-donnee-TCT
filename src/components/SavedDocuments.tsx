import React, { useEffect, useState } from 'react';
import { getUserDocuments } from '../services/supabaseService';
import type { TctDocument } from '../lib/supabaseClient';
import { Button } from './Button';
export function SavedDocuments({ userId, refreshKey, onOpen }: {
    userId: string; refreshKey: number; onOpen: (id: number) => Promise<void>;
}) {
    const [documents, setDocuments] = useState<TctDocument[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [opening, setOpening] = useState<number | null>(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true; setLoading(true); setError('');
        getUserDocuments(userId).then(data => { if (active) setDocuments(data || []); })
            .catch(() => { if (active) setError('Historique indisponible. Vos résultats affichés restent accessibles ; réessayez le chargement.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [userId, refreshKey, refresh]);
    const open = async (id: number) => {
        setOpening(id); setError('');
        try { await onOpen(id); }
        catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.'); }
        finally { setOpening(null); }
    };
    return <details className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60">
        <summary className="cursor-pointer p-4 font-semibold text-slate-100 focus-visible:outline focus-visible:outline-emerald-400">
            Documents enregistrés {loading ? '— chargement…' : `(${documents.length}${documents.length === 50 ? ' derniers' : ''})`}
        </summary>
        <div className="px-4 pb-4 space-y-3">
            <p className="text-sm text-slate-400">Ces documents sont conservés dans votre compte et restent disponibles après rechargement.</p>
            <Button onClick={() => setRefresh(value => value + 1)} disabled={loading} className="bg-slate-700 hover:bg-slate-600">Actualiser l’historique</Button>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            {!loading && !error && !documents.length && <p className="text-sm text-slate-300">Aucun document enregistré. Le prochain scan TCT complet sera sauvegardé automatiquement.</p>}
            <ul className="space-y-2 max-h-64 overflow-y-auto">
                {documents.map(document => <li key={document.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-slate-900 p-3">
                    <div className="min-w-0"><p className="font-medium break-words">{document.filename}</p>
                        <p className="text-sm text-slate-400">{document.extracted_count} lignes · {new Date(document.created_at || document.upload_date).toLocaleString('fr-CA', { timeZone: 'America/Toronto' })}</p></div>
                    <Button onClick={() => void open(document.id!)} disabled={opening !== null} className="shrink-0 bg-emerald-700 hover:bg-emerald-600">
                        {opening === document.id ? 'Chargement…' : 'Ouvrir'}
                    </Button>
                </li>)}
            </ul>
        </div>
    </details>;
}
