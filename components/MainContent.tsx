import React from 'react';
import { ResultCard } from './ResultCard';
import { Button } from './Button';
import { Icons } from './Icons';
import { ExtractedData, SummaryData, TableData, Status, ChatMessage } from '../types';
import { ChatInterface } from './ChatInterface';

interface MainContentProps {
    activeView: 'extract' | 'chat';
    setActiveView: (view: 'extract' | 'chat') => void;
    extractedData: ExtractedData[];
    unifiedTable: TableData | null;
    summaryData: SummaryData | null;
    validationErrors: Map<number, string[]>;
    onGenerateResults: () => void;
    onValidateData: () => void;
    onDownload: (format: 'csv' | 'json') => void;
    onPrint: () => void;
    error: string | null;
    chatHistory: ChatMessage[];
    isChatLoading: boolean;
    onSendMessage: (message: string) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
    activeView,
    setActiveView,
    extractedData,
    unifiedTable,
    summaryData,
    validationErrors,
    onGenerateResults,
    onValidateData,
    onDownload,
    onPrint,
    error,
    chatHistory,
    isChatLoading,
    onSendMessage
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
                    {allProcessed && hasSuccessfulExtractions && !unifiedTable && (
                        <div className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700 flex items-center justify-between">
                            <p className="text-slate-300">L'extraction est terminée. Prêt à voir les résultats consolidés ?</p>
                            <Button
                                onClick={onGenerateResults}
                                className="bg-sky-600 hover:bg-sky-700"
                            >
                                <Icons.Eye className="mr-2" />
                                Générer le Tableau Final
                            </Button>
                        </div>
                    )}

                    {error && <p className="text-red-400 my-4 text-center p-4 bg-red-900/20 border border-red-500/30 rounded-md">{error}</p>}
                    
                    {unifiedTable && summaryData && (
                        <section className="mb-12">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold text-slate-200">Résultats Unifiés</h2>
                                 <div className="flex gap-2">
                                     <Button onClick={onValidateData} className="bg-yellow-600 hover:bg-yellow-700 text-sm py-2 px-3">
                                        <Icons.ShieldCheck className="mr-2" /> Valider
                                    </Button>
                                    <Button onClick={() => onDownload('csv')} className="bg-emerald-600 hover:bg-emerald-700 text-sm py-2 px-3">
                                        <Icons.FileCsv className="mr-2" /> CSV
                                    </Button>
                                    <Button onClick={() => onDownload('json')} className="bg-sky-600 hover:bg-sky-700 text-sm py-2 px-3">
                                        <Icons.FileJson className="mr-2" /> JSON
                                    </Button>
                                    <Button onClick={onPrint} className="bg-slate-500 hover:bg-slate-600 text-sm py-2 px-3">
                                        <Icons.Print className="mr-2" /> Imprimer
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-slate-200 mb-2">Résumé</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                                    <div className="bg-slate-700/50 p-3 rounded-md">
                                        <div className="font-bold text-slate-400">Lignes Uniques</div>
                                        <div className="text-2xl font-bold text-emerald-400">{summaryData?.totalRows ?? 0}</div>
                                    </div>
                                    <div className="bg-slate-700/50 p-3 rounded-md">
                                        <div className="font-bold text-slate-400">Chauffeurs Uniques</div>
                                        <div className="text-2xl font-bold text-sky-400">{summaryData?.uniqueChauffeurs.length ?? 0}</div>
                                    </div>
                                    <div className="bg-slate-700/50 p-3 rounded-md">
                                        <div className="font-bold text-slate-400">Véhicules Uniques</div>
                                        <div className="text-2xl font-bold text-sky-400">{summaryData?.uniqueVehicules.length ?? 0}</div>
                                    </div>
                                    <div className="bg-slate-700/50 p-3 rounded-md">
                                        <div className="font-bold text-slate-400">Adresses Uniques</div>
                                        <div className="text-2xl font-bold text-sky-400">{ new Set([...summaryData?.uniqueAdressesDepart ?? [], ...summaryData?.uniqueAdressesArrivee ?? []]).size }</div>
                                    </div>
                                </div>
                                
                                {validationErrors.size > 0 && (
                                    <div className="my-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-md text-yellow-300 text-sm">
                                        <h4 className="font-bold flex items-center"><Icons.ShieldCheck className="w-4 h-4 mr-2"/>Validation terminée</h4>
                                        <p>{validationErrors.size} ligne{validationErrors.size > 1 ? 's' : ''} avec des problèmes potentiels ont été trouvée{validationErrors.size > 1 ? 's' : ''}. Survolez-les pour plus de détails.</p>
                                    </div>
                                )}


                                <h3 className="text-lg font-semibold text-slate-200 mb-2">Tableau Final Unifié</h3>
                                <div className="overflow-auto border border-slate-700 rounded-md max-h-96">
                                    <table className="w-full text-left text-xs">
                                        <thead className="sticky top-0 bg-slate-800/80 backdrop-blur-sm">
                                            <tr className="text-slate-300">
                                                {unifiedTable?.headers.map((header, index) => (
                                                    <th key={index} className="p-2 font-semibold border-b border-slate-600">{header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {unifiedTable?.rows.map((row, rowIndex) => {
                                                const errors = validationErrors.get(rowIndex);
                                                const rowClasses = errors
                                                    ? "border-t border-slate-700 bg-yellow-800/30 hover:bg-yellow-700/40 cursor-help"
                                                    : "border-t border-slate-700 even:bg-slate-700/30 hover:bg-slate-700/50";
                                                const errorTitle = errors ? `Problèmes:\n- ${errors.join('\n- ')}` : undefined;

                                                return (
                                                    <tr key={rowIndex} className={rowClasses} title={errorTitle}>
                                                        {row.map((cell, cellIndex) => (
                                                            <td key={cellIndex} className="p-2 text-slate-300">{cell}</td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                    )}

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
                            onClick={() => setActiveView('chat')}
                            disabled={!unifiedTable}
                            className={`px-3 py-2 font-medium text-sm rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeView === 'chat' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Icons.MessageCircle className="inline-block mr-2 w-5 h-5" />
                            Chat
                        </button>
                    </nav>
                </div>

                <div className="flex-grow">
                    {activeView === 'extract' ? renderExtractionView() : (
                         <ChatInterface 
                            history={chatHistory} 
                            isLoading={isChatLoading} 
                            onSendMessage={onSendMessage} 
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