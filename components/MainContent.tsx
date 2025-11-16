import React from 'react';
import { ResultCard } from './ResultCard';
import { Button } from './Button';
import { Icons } from './Icons';
import { ExtractedData, Status, TableData } from '../types';
import { FinalDocumentView } from './FinalDocumentView';

interface MainContentProps {
    activeView: 'extract' | 'document';
    setActiveView: (view: 'extract' | 'document') => void;
    extractedData: ExtractedData[];
    onGenerateResults: () => void;
    error: string | null;
    unifiedTable: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
    activeView,
    setActiveView,
    extractedData,
    onGenerateResults,
    error,
    unifiedTable,
    onPrint,
    onDownloadPdf,
}) => {

    const allProcessed = extractedData.length > 0 && extractedData.every(d => d.status === Status.Success || d.status === Status.Error);
    const hasSuccessfulExtractions = extractedData.some(d => d.status === Status.Success && d.content && d.content.rows.length > 0);

    const renderExtractionView = () => (
        <>
            {extractedData.length === 0 ? (
                <div className="text-center h-full flex flex-col justify-center items-center">
                     <Icons.UploadCloud className="w-16 h-16 text-slate-600 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-400">Commencez par téléverser des fichiers</h2>
                    <p className="text-slate-500 mt-2">Utilisez le panneau de gauche pour ajouter des images ou des PDFs.</p>
                </div>
            ) : (
                <div>
                    {allProcessed && hasSuccessfulExtractions && (
                        <div className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700 flex items-center justify-between">
                            <p className="text-slate-300">L'extraction est terminée. Prêt à voir les résultats consolidés ?</p>
                            <Button
                                onClick={onGenerateResults}
                                className="bg-sky-600 hover:bg-sky-700"
                            >
                                <Icons.Eye className="mr-2" />
                                Ouvrir le Document Final
                            </Button>
                        </div>
                    )}

                    {error && <p className="text-red-400 my-4 text-center p-4 bg-red-900/20 border border-red-500/30 rounded-md">{error}</p>}

                    <h2 className="text-2xl font-bold text-center mb-8 text-slate-300">Extraction par Fichier</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {extractedData.map((data) => (
                            <ResultCard key={data.id} data={data} />
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    return (
        <main className="flex-grow p-4 md:p-8 overflow-y-auto flex flex-col">
             <div className="max-w-7xl mx-auto w-full flex flex-col flex-grow">
                <div className="border-b border-slate-700 mb-4">
                    <nav className="flex space-x-4" aria-label="Tabs">
                        <button
                            onClick={() => setActiveView('extract')}
                            className={`px-3 py-2 font-medium text-sm rounded-t-md ${activeView === 'extract' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Icons.ScanText className="inline-block mr-2 w-5 h-5" />
                            Extraction
                        </button>
                        <button
                            onClick={() => setActiveView('document')}
                            disabled={!unifiedTable}
                            className={`px-3 py-2 font-medium text-sm rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeView === 'document' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Icons.Eye className="inline-block mr-2 w-5 h-5" />
                            Document Final
                        </button>
                    </nav>
                </div>

                <div className="flex-grow">
                    {activeView === 'extract' ? renderExtractionView() : (
                         <FinalDocumentView
                            tableData={unifiedTable}
                            onPrint={onPrint}
                            onDownloadPdf={onDownloadPdf}
                        />
                    )}
                </div>
                
                {activeView === 'extract' && (
                    <footer className="text-center p-4 mt-8 text-slate-500 text-sm">
                        <p>Propulsé par Zakibelm</p>
                    </footer>
                )}
            </div>
        </main>
    );
};