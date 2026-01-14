import React, { useMemo } from 'react';
import { ExtractedData, Status } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';

interface ReportViewProps {
    extractedData: ExtractedData[];
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ extractedData, onPrint, onDownloadPdf }) => {

    // Flatten all data from all files into a single table
    const { headers, rows } = useMemo(() => {
        if (!extractedData || extractedData.length === 0) return { headers: [], rows: [] };

        const successfulData = extractedData.filter(d => d.status === Status.Success && d.content);

        if (successfulData.length === 0) return { headers: [], rows: [] };

        // Use headers from the first successful extraction
        const masterHeaders = successfulData[0].content!.headers;

        // Concatenate all rows
        const allRows = successfulData.flatMap(d => d.content!.rows);

        return {
            headers: masterHeaders,
            rows: allRows
        };
    }, [extractedData]);

    if (!extractedData || extractedData.length === 0) {
        return <div className="p-8 text-center text-slate-400">Aucune extraction effectuée.</div>;
    }

    return (
        <div className="flex flex-col h-full text-slate-200">
            <div className="flex-shrink-0 p-4 bg-slate-800/50 border-b border-slate-700">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-emerald-400 flex items-center">
                            <Icons.ClipboardList className="mr-2 h-5 w-5" />
                            Historique des Données (Extraction Brute)
                        </h2>
                        <p className="text-sm text-slate-400">
                            Affiche les données telles qu'elles ont été extraites, sans modification.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => onDownloadPdf(headers, rows)} className="bg-red-600 hover:bg-red-700 text-sm py-2 px-3" disabled={rows.length === 0}>
                            <Icons.FilePdf className="mr-2" /> PDF
                        </Button>
                        <Button
                            onClick={() => onPrint(headers, rows)}
                            className="bg-slate-500 hover:bg-slate-600 text-sm py-2 px-3"
                            disabled={rows.length === 0}
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
                            {rows.length > 0 ? (
                                rows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="border-t border-slate-700 hover:bg-slate-700/50 bg-slate-800/20">
                                        {row.map((cell, cellIndex) => (
                                            <td key={cellIndex} className="p-2 text-slate-300 whitespace-nowrap">
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={headers.length > 0 ? headers.length : 1} className="text-center p-12">
                                        <div className="flex flex-col items-center justify-center text-slate-500">
                                            <Icons.CheckCircle className="w-12 h-12 mb-3 text-slate-600" />
                                            <p className="text-lg font-medium">Aucune donnée brute disponible</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex-shrink-0 p-2 bg-slate-800/50 border-t border-slate-700 text-right text-sm text-slate-400">
                Total lignes : {rows.length}
            </div>
        </div>
    );
};
