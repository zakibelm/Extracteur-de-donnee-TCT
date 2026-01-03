import React from 'react';
import { TableData } from '../types'; // Removed User import as it is unused
import { Button } from './Button';
import { Icons } from './Icons';
import { User } from '../types'; // Adjusted import

interface FinalDocumentViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
    onTableUpdate: (table: TableData) => void; // Added for editable functionality or I will just pass it
    user: User | null;
}

export const FinalDocumentView: React.FC<FinalDocumentViewProps> = ({
    tableData,
    onPrint,
    onDownloadPdf,
    onTableUpdate
}) => {
    if (!tableData) return null;

    return (
        <div className="flex flex-col h-full bg-slate-900">
            <div className="bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-200">Document Final</h2>
                    <p className="text-slate-400 text-sm mt-1">{tableData.rows.length} enregistrements extraits</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => onDownloadPdf(tableData.headers, tableData.rows)} className="bg-red-600 hover:bg-red-700 text-sm py-2 px-3">
                        <Icons.FilePdf className="mr-2" /> PDF
                    </Button>
                    <Button onClick={() => onPrint(tableData.headers, tableData.rows)} className="bg-slate-500 hover:bg-slate-600 text-sm py-2 px-3">
                        <Icons.Print className="mr-2" /> Imprimer
                    </Button>
                </div>
            </div>

            <div className="flex-grow overflow-auto p-6">
                <div className="bg-slate-800 rounded-lg shadow-xl overflow-hidden border border-slate-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-700/50 border-b border-slate-600">
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase w-12">#</th>
                                    {tableData.headers.map((h, i) => (
                                        <th key={i} className="p-4 text-xs font-semibold text-slate-400 uppercase whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {tableData.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4 text-slate-500 text-xs font-mono">{idx + 1}</td>
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} className="p-4 text-sm text-slate-300 whitespace-nowrap">
                                                {cell}
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
