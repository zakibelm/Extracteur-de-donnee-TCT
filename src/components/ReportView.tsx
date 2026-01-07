import React, { useMemo } from 'react';
import { TableData } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';

interface ReportViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ tableData, onPrint, onDownloadPdf }) => {

    // Détermination des colonnes et filtrage
    const { headers, filteredRows, changementParIndex } = useMemo(() => {
        if (!tableData) return { headers: [], filteredRows: [], changementParIndex: -1 };

        const changementParIdx = tableData.headers.indexOf('Changement par');

        // Si la colonne n'existe pas ou s'il n'y a pas de données
        if (changementParIdx === -1) {
            return { headers: tableData.headers, filteredRows: [], changementParIndex: -1 };
        }

        // Filtrer pour ne garder que les lignes où "Changement par" n'est pas vide
        const rows = tableData.rows.filter(row => {
            const val = row[changementParIdx];
            return val && val.trim() !== '';
        });

        return {
            headers: tableData.headers,
            filteredRows: rows,
            changementParIndex: changementParIdx
        };
    }, [tableData]);

    if (!tableData) {
        return <div className="p-8 text-center text-slate-400">Aucune donnée à afficher.</div>;
    }

    return (
        <div className="flex flex-col h-full text-slate-200 font-sans">
            <div className="flex-shrink-0 p-4 md:p-6 bg-slate-900/40 border-b border-white/10 backdrop-blur-md">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center">
                            <Icons.ClipboardList className="mr-3 h-5 w-5 md:h-6 md:w-6 text-emerald-400" />
                            Rapport des Modifications
                        </h2>
                        <p className="text-xs md:text-sm text-slate-400 mt-1 font-medium ml-1">
                            Affiche uniquement les tours modifiés manuellement.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => onDownloadPdf(headers, filteredRows)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 text-sm py-2 px-4 backdrop-blur-sm transition-all"
                            disabled={filteredRows.length === 0}
                        >
                            <Icons.FilePdf className="mr-2 h-4 w-4" /> Exporter PDF
                        </Button>
                        <Button
                            onClick={() => onPrint(headers, filteredRows)}
                            className="bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 border border-white/10 hover:border-white/20 text-sm py-2 px-4 backdrop-blur-sm transition-all"
                            disabled={filteredRows.length === 0}
                        >
                            <Icons.Print className="mr-2 h-4 w-4" /> Imprimer
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-x-auto p-3 md:p-6">
                <div className="border border-white/10 rounded-xl overflow-hidden shadow-2xl bg-slate-900/20 backdrop-blur-sm min-w-[600px] md:min-w-0">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-md z-10 border-b border-white/10">
                            <tr className="text-emerald-500/90 text-xs uppercase tracking-wider">
                                {headers.map((header, index) => (
                                    <th key={index} className="p-4 font-bold select-none whitespace-nowrap">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredRows.length > 0 ? (
                                filteredRows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="hover:bg-white/[0.02] transition-colors duration-150 group">
                                        {row.map((cell, cellIndex) => {
                                            if (cellIndex === changementParIndex) {
                                                return (
                                                    <td key={cellIndex} className="p-4 text-cyan-400 font-bold whitespace-nowrap bg-cyan-950/10 group-hover:bg-cyan-950/20 transition-colors">
                                                        {cell}
                                                    </td>
                                                );
                                            }
                                            return (
                                                <td key={cellIndex} className="p-4 text-slate-300 whitespace-nowrap group-hover:text-slate-100 transition-colors">
                                                    {cell}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={headers.length} className="text-center p-20">
                                        <div className="flex flex-col items-center justify-center text-slate-600">
                                            <div className="p-4 bg-slate-800/50 rounded-full mb-4 ring-1 ring-white/5">
                                                <Icons.CheckCircle className="w-10 h-10 text-emerald-500/50" />
                                            </div>
                                            <p className="text-lg font-medium text-slate-400">Aucune modification détectée</p>
                                            <p className="text-sm mt-1 text-slate-500">Les changements effectués par les utilisateurs apparaîtront ici.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex-shrink-0 p-3 bg-slate-950/30 border-t border-white/5 text-right text-xs text-slate-500 font-mono tracking-wide px-6">
                TOTAL MODIFICATIONS: <span className="text-emerald-400 font-bold">{filteredRows.length}</span>
            </div>
        </div>
    );
};
