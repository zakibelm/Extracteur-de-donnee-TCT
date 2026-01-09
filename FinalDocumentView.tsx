
import React, { useState, useMemo, useEffect } from 'react';
import { TableData } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';
import { Modal } from './Modal';
import { User } from './AuthPage';
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
    const [focusedValue, setFocusedValue] = useState<string>('');

    useEffect(() => {
        if (tableData) {
            setRows(tableData.rows.map(row => [...row]));
        }
    }, [tableData]);

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
        link.setAttribute('download', `ADT_Consolidation_${new Date().toISOString().split('T')[0]}.csv`);
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
                if (indices.changement !== -1) newRow[indices.changement] = pendingChange.newValue;
                if (indices.vehicule !== -1) newRow[indices.vehicule] = pendingChange.newValue;
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

    if (!tableData) return <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest">Initialisation du tableau maître...</div>;

    return (
        <div className="flex flex-col h-full text-slate-200">
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Validation Super Admin">
                <div className="space-y-4">
                    <p className="text-slate-300">Confirmer la réassignation du véhicule pour la tournée <span className="text-emerald-400 font-bold">{pendingChange?.tournee}</span> ?</p>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button onClick={() => setIsModalOpen(false)} className="bg-slate-700">Annuler</Button>
                        <Button onClick={confirmChange} className="bg-emerald-600">Confirmer</Button>
                    </div>
                </div>
            </Modal>

            <div className="p-6 bg-slate-800/40 border-b border-slate-700 backdrop-blur-md sticky top-0 z-20">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex gap-4 flex-1 w-full">
                        <div className="relative flex-1">
                            <Icons.ScanText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                            <input 
                                type="text" placeholder="Filtrer tournées..." 
                                value={tourneeFilter} onChange={e => setTourneeFilter(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                            />
                        </div>
                        <div className="relative flex-1">
                            <Icons.Database className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                            <input 
                                type="text" placeholder="Filtrer véhicules..." 
                                value={vehiculeFilter} onChange={e => setVehiculeFilter(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button onClick={exportToCsv} className="bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all px-4 py-2 text-xs font-black uppercase">
                            <Icons.UploadCloud className="w-4 h-4 mr-2 rotate-180" /> Export CSV
                        </Button>
                        <Button onClick={() => onDownloadPdf(tableData.headers, filteredRows)} className="bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600 hover:text-white px-4 py-2 text-xs font-black uppercase">
                            <Icons.FilePdf className="w-4 h-4 mr-2" /> PDF
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-auto p-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-slate-800/80 text-slate-400 uppercase font-black tracking-tighter">
                                {tableData.headers.map((h, i) => (
                                    <th key={i} className="px-4 py-3 border-b border-slate-700">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row, ri) => (
                                <tr key={ri} className="hover:bg-emerald-500/5 transition-colors border-b border-slate-800/50">
                                    {row.map((cell, ci) => (
                                        <td key={ci} className={`px-4 py-2.5 whitespace-nowrap ${ci === indices.vehicule ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                                            {ci === indices.changement ? (
                                                <input 
                                                    value={cell} 
                                                    onChange={e => {
                                                        const nr = [...rows];
                                                        nr[ri][ci] = e.target.value;
                                                        setRows(nr);
                                                    }}
                                                    onBlur={e => {
                                                        setPendingChange({ row, tournee: row[indices.tournee], oldValue: cell, newValue: e.target.value });
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 w-24 text-emerald-400 focus:border-emerald-500 outline-none"
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
    );
};
