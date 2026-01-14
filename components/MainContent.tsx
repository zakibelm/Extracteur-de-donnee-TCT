import React from 'react';
import { ResultCard } from './ResultCard';
import { Button } from './Button';
import { Icons } from './Icons';
import { ExtractedData, Status, TableData, User } from '../types';
import { FinalDocumentView } from './FinalDocumentView';
import { HistoryView } from './HistoryView';
import { ReportView } from './ReportView';

interface MainContentProps {
    activeSection: 'tct' | 'olymel' | 'settings';
    setActiveSection: (section: 'tct' | 'olymel' | 'settings') => void;

    // TCT Props
    activeTctView: 'extract' | 'document' | 'report' | 'history';
    setActiveTctView: (view: 'extract' | 'document' | 'report' | 'history') => void;
    tctExtractedData: ExtractedData[];
    onTctGenerateResults: () => void;
    tctError: string | null;
    tctUnifiedTable: TableData | null;
    onTctTableUpdate: (table: TableData) => void;
    onTctDeleteResult: (id: string) => void;

    // Olymel Props
    activeOlymelView: 'extract' | 'calendar' | 'report';
    setActiveOlymelView: (view: 'extract' | 'calendar' | 'report') => void;
    olymelExtractedData: ExtractedData[];
    onOlymelGenerateResults: () => void;
    olymelError: string | null;
    olymelUnifiedTable: TableData | null;
    onOlymelTableUpdate: (table: TableData) => void;
    onOlymelDeleteResult: (id: string) => void;

    // Common Props
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
    user: User;
    onLogout: () => void;
    // Sidebar props if needed for mobile toggle
    isSidebarOpen?: boolean;
    setIsSidebarOpen?: (isOpen: boolean) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
    activeSection,
    activeTctView,
    setActiveTctView,
    tctExtractedData,
    onTctGenerateResults,
    tctError,
    tctUnifiedTable,
    onTctTableUpdate,
    onTctDeleteResult,

    activeOlymelView,
    setActiveOlymelView,
    olymelExtractedData,
    onOlymelGenerateResults,
    olymelError,
    olymelUnifiedTable,
    onOlymelTableUpdate,
    onOlymelDeleteResult,

    onPrint,
    onDownloadPdf,
    user,
    onLogout,
    setIsSidebarOpen
}) => {

    // Determine current processing status based on section
    const currentExtractedData = activeSection === 'tct' ? tctExtractedData : olymelExtractedData;
    const currentError = activeSection === 'tct' ? tctError : olymelError;

    const allProcessed = currentExtractedData.length > 0 && currentExtractedData.every(d => d.status === Status.Success || d.status === Status.Error);
    const hasSuccessfulExtractions = currentExtractedData.some(d => d.status === Status.Success && d.content && d.content.rows.length > 0);

    const renderExtractionView = () => (
        <div className="h-full flex flex-col p-4 md:p-8">
            {currentExtractedData.length === 0 ? (
                <div className="flex-grow flex flex-col justify-center items-center text-center px-4">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 md:mb-8 border border-zinc-800">
                        <Icons.UploadCloud className="w-6 h-6 md:w-8 md:h-8 text-zinc-700" />
                    </div>
                    <h2 className="text-lg md:text-xl font-black text-zinc-500 uppercase tracking-[0.2em] md:tracking-[0.3em]">Aucun scan actif</h2>
                    <p className="text-xs text-zinc-600 mt-2">Utilisez la barre latérale pour importer des documents.</p>
                </div>
            ) : (
                <div className="space-y-6 md:space-y-8 pb-10">
                    {allProcessed && hasSuccessfulExtractions && (
                        <div className="bg-red-600/10 rounded-3xl p-6 md:p-8 border border-red-600/20 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="text-center md:text-left">
                                <h3 className="text-red-500 font-black uppercase tracking-widest text-xs md:text-sm">Extraction Terminée</h3>
                                <p className="text-zinc-500 text-[10px] md:text-xs mt-1">Données consolidées prêtes pour vérification.</p>
                            </div>
                            <Button
                                onClick={activeSection === 'tct' ? onTctGenerateResults : onOlymelGenerateResults}
                                className="w-full md:w-auto bg-red-600 hover:bg-red-500 shadow-2xl shadow-red-900/30 px-8 py-3 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest"
                            >
                                Valider les données
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                        {currentExtractedData.map((data) => (
                            <ResultCard
                                key={data.id}
                                data={data}
                                onDelete={activeSection === 'tct' ? onTctDeleteResult : onOlymelDeleteResult}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderTctContent = () => {
        if (!user.isAdmin && activeTctView === 'extract') {
            return <FinalDocumentView tableData={tctUnifiedTable} onPrint={onPrint} onDownloadPdf={onDownloadPdf} onTableUpdate={onTctTableUpdate} user={user} />;
        }

        switch (activeTctView) {
            case 'extract': return renderExtractionView();
            case 'document': return (
                <FinalDocumentView
                    tableData={tctUnifiedTable}
                    onPrint={onPrint}
                    onDownloadPdf={onDownloadPdf}
                    onTableUpdate={onTctTableUpdate}
                    user={user}
                />
            );
            case 'report': return (
                <ReportView
                    tableData={tctUnifiedTable} // Now expects TableData
                    onPrint={onPrint}
                    onDownloadPdf={onDownloadPdf}
                />
            );
            case 'history': return (
                <HistoryView
                    extractedData={tctExtractedData}
                    onPrint={onPrint}
                    onDownloadPdf={onDownloadPdf}
                />
            );
            default: return null;
        }
    };

    const renderOlymelContent = () => {
        // Placeholder for Olymel content logic
        if (!user.isAdmin && activeOlymelView === 'extract') {
            return <div className="p-8">Vue Calendrier Olymel (À implémenter)</div>;
        }

        switch (activeOlymelView) {
            case 'extract': return renderExtractionView();
            case 'calendar': return <div className="p-8 text-white">Vue Calendrier (Work In Progress)</div>;
            case 'report': return <div className="p-8 text-white">Vue Rapport Olymel (Work In Progress)</div>;
            default: return null;
        }
    };

    return (
        <main className="flex-grow overflow-hidden flex flex-col bg-black">
            <div className="flex-grow flex flex-col h-full overflow-hidden">
                <header className="px-4 md:px-8 pt-6 md:pt-8 border-b border-zinc-900 flex flex-col md:flex-row gap-4 justify-between items-center bg-black sticky top-0 z-30">
                    <div className="flex items-center w-full md:w-auto gap-4">
                        {/* Mobile Toggle Button */}
                        <button
                            onClick={() => setIsSidebarOpen && setIsSidebarOpen(true)}
                            className="lg:hidden p-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl active:scale-95 transition-all"
                        >
                            <Icons.ChevronRight className="w-5 h-5" />
                        </button>

                        <nav className="flex space-x-6 md:space-x-12 overflow-x-auto no-scrollbar pb-4 md:pb-6 flex-grow">
                            {activeSection === 'tct' && (
                                <>
                                    {user.isAdmin && (
                                        <button
                                            onClick={() => setActiveTctView('extract')}
                                            className={`whitespace-nowrap pb-1 md:pb-6 px-1 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all relative ${activeTctView === 'extract' ? 'text-red-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                                        >
                                            {activeTctView === 'extract' && <span className="absolute bottom-[-4px] md:bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]"></span>}
                                            Extraction
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setActiveTctView('document')}
                                        className={`whitespace-nowrap pb-1 md:pb-6 px-1 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all relative ${activeTctView === 'document' ? 'text-red-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                                    >
                                        {activeTctView === 'document' && <span className="absolute bottom-[-4px] md:bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]"></span>}
                                        Document Final
                                    </button>
                                    <button
                                        onClick={() => setActiveTctView('report')}
                                        className={`whitespace-nowrap pb-1 md:pb-6 px-1 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all relative ${activeTctView === 'report' ? 'text-red-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                                    >
                                        {activeTctView === 'report' && <span className="absolute bottom-[-4px] md:bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]"></span>}
                                        Rapport
                                    </button>
                                    <button
                                        onClick={() => setActiveTctView('history')}
                                        className={`whitespace-nowrap pb-1 md:pb-6 px-1 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all relative ${activeTctView === 'history' ? 'text-red-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                                    >
                                        {activeTctView === 'history' && <span className="absolute bottom-[-4px] md:bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]"></span>}
                                        Historique
                                    </button>
                                </>
                            )}
                            {activeSection === 'olymel' && (
                                <>
                                    <button onClick={() => setActiveOlymelView('extract')} className={`... ${activeOlymelView === 'extract' ? 'text-red-500' : 'text-zinc-600'}`}>Extraction</button>
                                    <button onClick={() => setActiveOlymelView('calendar')} className={`... ${activeOlymelView === 'calendar' ? 'text-red-500' : 'text-zinc-600'}`}>Calendrier</button>
                                </>
                            )}
                        </nav>

                        <div className="hidden md:flex items-center gap-6 pb-6">
                            <button onClick={onLogout} className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-red-500 rounded-2xl transition-all">
                                <Icons.LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </header>

                {currentError && (
                    <div className="mx-4 md:mx-8 mt-4 p-4 bg-red-600/10 border border-red-600/20 rounded-2xl flex items-center gap-4 text-red-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest animate-pulse">
                        <Icons.XCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="truncate">{currentError}</span>
                    </div>
                )}

                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    {activeSection === 'tct' ? renderTctContent() : renderOlymelContent()}
                </div>
            </div>
        </main>
    );
};
