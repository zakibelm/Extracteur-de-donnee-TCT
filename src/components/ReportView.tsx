import React from 'react';
import { TableData } from '../types';
import { Button } from './Button';
import { Icons } from './Icons';

interface ReportViewProps {
    tableData: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
    tableData,
    onPrint,
    onDownloadPdf
}) => {
    if (!tableData) return null;

    return (
        <div className="flex flex-col h-full bg-slate-900 justify-center items-center">
            <div className="text-center p-8 bg-slate-800 rounded-lg border border-slate-700 max-w-lg">
                <Icons.ClipboardList className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Rapport Généré</h2>
                <p className="text-slate-400 mb-6">
                    Le rapport contient {tableData.rows.length} entrées prêtes à être exportées.
                </p>
                <div className="flex gap-4 justify-center">
                    <Button onClick={() => onDownloadPdf(tableData.headers, tableData.rows)} className="bg-emerald-600 hover:bg-emerald-700">
                        <Icons.FilePdf className="mr-2" /> Télécharger PDF
                    </Button>
                    <Button onClick={() => onPrint(tableData.headers, tableData.rows)} className="bg-slate-600 hover:bg-slate-700">
                        <Icons.Print className="mr-2" /> Imprimer
                    </Button>
                </div>
            </div>
        </div>
    );
};
