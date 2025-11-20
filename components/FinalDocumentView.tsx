import React, { useState, useMemo } from 'react';
import { TableData } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';

interface FinalDocumentViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
}

export const FinalDocumentView: React.FC<FinalDocumentViewProps> = ({ tableData, onPrint, onDownloadPdf }) => {
    const [tourneeFilter, setTourneeFilter] = useState('');
    const [vehiculeFilter, setVehiculeFilter] = useState('');

    const { tourneeIndex, vehiculeIndex } = useMemo(() => {
        if (!tableData) return { tourneeIndex: -1, vehiculeIndex: -1 };
        return {
            tourneeIndex: tableData.headers.indexOf('Tournée'),
            vehiculeIndex: tableData.headers.indexOf('Véhicule'),
        };
    }, [tableData]);

    const filteredRows = useMemo(() => {
        if (!tableData) return [];

        return tableData.rows.filter(row => {
            const tourneeMatch = tourneeIndex === -1 || !tourneeFilter || row[tourneeIndex]?.toLowerCase().includes(tourneeFilter.toLowerCase());
            const vehiculeMatch = vehiculeIndex === -1 || !vehiculeFilter || row[vehiculeIndex]?.toLowerCase().includes(vehiculeFilter.toLowerCase());
            
            return tourneeMatch && vehiculeMatch;
        });
    }, [tableData, tourneeFilter, vehiculeFilter, tourneeIndex, vehiculeIndex]);

    const resetFilters = () => {
        setTourneeFilter('');
        setVehiculeFilter('');
    };

    if (!tableData) {
        return <div className="p-8 text-center text-slate-400">Aucune donnée à afficher.</div>;
    }

    return (
        <div className="flex flex-col h-full text-slate-200">
            {/* Toolbar */}
            <div className="flex-shrink-0 p-4 bg-slate-800/50 border-b border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    {/* Filters */}
                    <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1">Filtrer par Tournée</label>
                            <input
                                type="text"
                                placeholder="ex: 12345"
                                value={tourneeFilter}
                                onChange={(e) => setTourneeFilter(e.target.value)}
                                className="w-full bg-slate-700 text-slate-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                         <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1">Filtrer par Véhicule</label>
                            <input
                                type="text"
                                placeholder="ex: ABC-123"
                                value={vehiculeFilter}
                                onChange={(e) => setVehiculeFilter(e.target.value)}
                                className="w-full bg-slate-700 text-slate-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2">
                         <Button onClick={resetFilters} className="bg-slate-600 hover:bg-slate-500 text-sm py-2 px-3">
                            Réinitialiser
                        </Button>
                         <Button onClick={() => onDownloadPdf(tableData.headers, filteredRows)} className="bg-red-600 hover:bg-red-700 text-sm py-2 px-3">
                            <Icons.FilePdf className="mr-2" /> PDF
                        </Button>
                        <Button onClick={() => onPrint(tableData.headers, filteredRows)} className="bg-slate-500 hover:bg-slate-600 text-sm py-2 px-3">
                            <Icons.Print className="mr-2" /> Imprimer
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-grow overflow-x-auto p-4">
                <div className="border border-slate-700 rounded-md">
                    <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-800/80 backdrop-blur-sm z-10">
                            <tr className="text-slate-300">
                                {tableData.headers.map((header, index) => (
                                    <th key={index} className="p-2 font-semibold border-b border-slate-600">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length > 0 ? (
                                filteredRows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="border-t border-slate-700 even:bg-slate-700/30 hover:bg-slate-700/50">
                                        {row.map((cell, cellIndex) => (
                                            <td key={cellIndex} className="p-2 text-slate-300 whitespace-nowrap">{cell}</td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={tableData.headers.length} className="text-center p-8 text-slate-500">
                                        Aucun résultat ne correspond à vos filtres.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
             <div className="flex-shrink-0 p-2 bg-slate-800/50 border-t border-slate-700 text-right text-sm text-slate-400">
                Affiche {filteredRows.length} sur {tableData.rows.length} lignes
            </div>
        </div>
    );
};