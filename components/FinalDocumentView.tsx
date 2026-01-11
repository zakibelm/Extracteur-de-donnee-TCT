
import React, { useState, useMemo, useEffect } from 'react';
import { TableData, User } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';
import { Modal } from './Modal';
import { gasService } from '../services/gasService';

interface FinalDocumentViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
    onTableUpdate: (table: TableData) => void;
    user: User;
}

export const FinalDocumentView: React.FC<FinalDocumentViewProps> = ({ tableData, onPrint, onDownloadPdf, onTableUpdate, user }) => {
    const [tourneeFilter, setTourneeFilter] = useState('');
    const [vehiculeFilter, setVehiculeFilter] = useState('');
    const [rows, setRows] = useState<string[][]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingChange, setPendingChange] = useState<any>(null);
    const [isLoadingFromSheets, setIsLoadingFromSheets] = useState(false);
    const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

    useEffect(() => {
        if (tableData) {
            setRows(tableData.rows.map(row => [...row]));
        }
    }, [tableData]);

    const loadFromGoogleSheets = async () => {
        if (isLoadingFromSheets) return; // Éviter les appels multiples

        setIsLoadingFromSheets(true);
        try {
            const { sheetsService } = await import('../services/sheetsService');
            console.log('📥 Chargement depuis Google Sheets pour', user?.numDome);
            const result = await sheetsService.fetchFromGoogleSheets(user?.numDome);

            if (result.success && result.data && result.data.rows.length > 0) {
                onTableUpdate(result.data);
                console.log('✅ Données chargées depuis Google Sheets:', result.data.rows.length, 'lignes');
            } else {
                console.log('ℹ️ Aucune donnée trouvée dans Google Sheets pour', user?.numDome);
            }
        } catch (error) {
            console.error('❌ Erreur chargement Google Sheets:', error);
        } finally {
            setIsLoadingFromSheets(false);
            setHasAttemptedLoad(true);
        }
    };

    // Chargement automatique au montage si pas de données
    useEffect(() => {
        if (!hasAttemptedLoad && (!tableData || tableData.rows.length === 0)) {
            console.log('🔄 Tentative de chargement automatique...');
            loadFromGoogleSheets();
        }
    }, [hasAttemptedLoad, tableData]); // Dépendances correctes

    const indices = useMemo(() => {
        if (!tableData) return { tournee: -1, vehicule: -1, debut: -1, changement: -1, changementPar: -1 };
        return {
            tournee: tableData.headers.indexOf('Tournée'),
            vehicule: tableData.headers.indexOf('Véhicule'),
            debut: tableData.headers.indexOf('Début tournée'),
            changement: tableData.headers.indexOf('Changement'),
            changementPar: tableData.headers.indexOf('Changement par'),
        };
    }, [tableData]);

    const filteredRows = useMemo(() => {
        if (!rows) return [];
        return rows.filter(row => {
            const tMatch = indices.tournee === -1 || !tourneeFilter || row[indices.tournee]?.toLowerCase().includes(tourneeFilter.toLowerCase());
            const vMatch = indices.vehicule === -1 || !vehiculeFilter || row[indices.vehicule]?.toLowerCase().includes(vehiculeFilter.toLowerCase());
            return tMatch && vMatch;
        });
    }, [rows, tourneeFilter, vehiculeFilter, indices]);

    const exportToCsv = () => {
        if (!tableData) return;
        const csvContent = [
            tableData.headers.join(','),
            ...filteredRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `ADT_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const confirmChange = async () => {
        if (tableData && pendingChange) {
            const rowIndex = rows.indexOf(pendingChange.row);
            if (rowIndex !== -1) {
                const newRows = [...rows];
                const newRow = [...newRows[rowIndex]];

                // On met à jour la colonne "Véhicule" et les colonnes de traçabilité
                if (indices.vehicule !== -1) newRow[indices.vehicule] = pendingChange.newValue;
                if (indices.changement !== -1) newRow[indices.changement] = pendingChange.newValue;
                if (indices.changementPar !== -1) newRow[indices.changementPar] = user.numDome;

                newRows[rowIndex] = newRow;
                setRows(newRows);
                onTableUpdate({ ...tableData, rows: newRows });

                await gasService.sendChangeRequest({
                    tournee: pendingChange.tournee,
                    oldValue: pendingChange.oldValue,
                    newValue: pendingChange.newValue,
                    user: user.numDome,
                    fullRow: newRow
                });
            }
        }
        setIsModalOpen(false);
    };

    if (!tableData) return <div className="p-12 text-center text-zinc-600 font-black uppercase tracking-[0.4em]">Initialisation...</div>;

    return (
        <div className="flex flex-col h-full bg-black">
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Validation Manuelle">
                <div className="p-4">
                    <p className="text-zinc-400 text-sm mb-6">Réassigner le véhicule pour la tournée <span className="text-red-500 font-bold">{pendingChange?.tournee}</span> ?</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase">Annuler</button>
                        <button onClick={confirmChange} className="px-6 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase">Confirmer</button>
                    </div>
                </div>
            </Modal>

            {/* Header avec bouton de rechargement */}
            <div className="flex justify-between items-center p-4 bg-gray-800/50 border-b border-gray-700">
                <h2 className="text-2xl font-bold text-white">Document Final</h2>
                <button
                    onClick={loadFromGoogleSheets}
                    disabled={isLoadingFromSheets}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {isLoadingFromSheets ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Chargement...</span>
                        </>
                    ) : (
                        <>
                            <span>🔄</span>
                            <span>Recharger depuis Google Sheets</span>
                        </>
                    )}
                </button>
            </div>

            <div className="p-4 md:p-8 bg-zinc-950/50 border-b border-zinc-900">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4 md:gap-6">
                    <div className="flex gap-4 flex-1 w-full">
                        <div className="relative flex-1">
                            <Icons.ScanText className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4" />
                            <input
                                type="text" placeholder="Filtrer tournées..."
                                value={tourneeFilter} onChange={e => setTourneeFilter(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-[10px] md:text-xs text-white focus:ring-1 focus:ring-red-600/50 outline-none transition-all"
                            />
                        </div>
                        <div className="relative flex-1">
                            <Icons.Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4" />
                            <input
                                type="text" placeholder="Filtrer véhicules..."
                                value={vehiculeFilter} onChange={e => setVehiculeFilter(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-[10px] md:text-xs text-white focus:ring-1 focus:ring-red-600/50 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <button onClick={exportToCsv} className="flex-1 lg:flex-none justify-center bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 px-4 md:px-6 py-3 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all">
                            <Icons.UploadCloud className="w-3 h-3 md:w-4 md:h-4 mr-2 inline-block rotate-180" /> CSV
                        </button>
                        <button onClick={() => onDownloadPdf(tableData.headers, filteredRows)} className="flex-1 lg:flex-none justify-center bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 px-4 md:px-6 py-3 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all">
                            <Icons.FilePdf className="w-3 h-3 md:w-4 md:h-4 mr-2 inline-block" /> PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-hidden p-4 md:p-8">
                <div className="h-full rounded-2xl md:rounded-3xl border border-zinc-900 overflow-hidden bg-zinc-950/30 flex flex-col">
                    <div className="overflow-auto flex-grow custom-scrollbar">
                        <table className="w-full text-left text-[10px] md:text-[11px] border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-zinc-900 text-zinc-500 uppercase font-black tracking-widest border-b border-zinc-800 sticky top-0 z-20">
                                    {tableData.headers.map((h, i) => (
                                        <th key={i} className="px-4 md:px-6 py-4 md:py-5 bg-zinc-900">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row, ri) => (
                                    <tr
                                        key={ri}
                                        className="group transition-all duration-300 border-b border-zinc-900/50 relative hover:bg-zinc-900/40"
                                    >
                                        {row.map((cell, ci) => (
                                            <td
                                                key={ci}
                                                className={`px-4 md:px-6 py-3 md:py-4 whitespace-nowrap transition-colors duration-300
                                                    ${ci === indices.vehicule ? 'text-red-500 font-bold' : 'text-zinc-400 group-hover:text-zinc-100'}
                                                `}
                                            >
                                                {ci === indices.vehicule ? (
                                                    <input
                                                        value={cell}
                                                        onChange={e => {
                                                            const nr = [...rows];
                                                            const actualRowIndex = rows.indexOf(row);
                                                            nr[actualRowIndex][ci] = e.target.value;
                                                            setRows(nr);
                                                        }}
                                                        onBlur={e => {
                                                            if (cell !== e.target.value) {
                                                                setPendingChange({
                                                                    row,
                                                                    tournee: row[indices.tournee],
                                                                    oldValue: cell,
                                                                    newValue: e.target.value
                                                                });
                                                                setIsModalOpen(true);
                                                            }
                                                        }}
                                                        className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 py-1 w-24 text-red-500 font-bold focus:border-red-600 outline-none"
                                                    />
                                                ) : cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
