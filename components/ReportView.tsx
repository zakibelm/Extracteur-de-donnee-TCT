
import React, { useMemo } from 'react';
import { TableData } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';

interface ReportViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ tableData, onPrint }) => {
    
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
        <div className="flex flex-col h-full text-slate-200">
            <div className="flex-shrink-0 p-4 bg-slate-800/50 border-b border-slate-700">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-emerald-400 flex items-center">
                            <Icons.ClipboardList className="mr-2 h-5 w-5" />
                            Rapport des Modifications (24h)
                        </h2>
                        <p className="text-sm text-slate-400">
                            Affiche uniquement les tournées dont le véhicule a été modifié manuellement.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => onPrint(headers, filteredRows)} 
                            className="bg-slate-500 hover:bg-slate-600 text-sm py-2 px-3"
                            disabled={filteredRows.length === 0}
                        >
                            <Icons.Print className="mr-2" /> Imprimer
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-x-auto p-4">
                <div className="border border-slate-700 rounded-md">
                    <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-800/80 backdrop-blur-sm z-10">
                            <tr className="text-slate-300">
                                {headers.map((header, index) => (
                                    <th key={index} className="p-2 font-semibold border-b border-slate-600 select-none">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length > 0 ? (
                                filteredRows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="border-t border-slate-700 hover:bg-slate-700/50 bg-slate-800/20">
                                        {row.map((cell, cellIndex) => {
                                            if (cellIndex === changementParIndex) {
                                                return (
                                                    <td key={cellIndex} className="p-2 text-sky-400 font-bold whitespace-nowrap bg-sky-900/10">
                                                        {cell}
                                                    </td>
                                                );
                                            }
                                            return (
                                                <td key={cellIndex} className="p-2 text-slate-300 whitespace-nowrap">
                                                    {cell}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={headers.length} className="text-center p-12">
                                        <div className="flex flex-col items-center justify-center text-slate-500">
                                            <Icons.CheckCircle className="w-12 h-12 mb-3 text-slate-600" />
                                            <p className="text-lg font-medium">Aucune modification détectée</p>
                                            <p className="text-sm">Les changements effectués par les utilisateurs apparaîtront ici.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
             <div className="flex-shrink-0 p-2 bg-slate-800/50 border-t border-slate-700 text-right text-sm text-slate-400">
                Total modifications : {filteredRows.length}
            </div>
        </div>
    );
};
