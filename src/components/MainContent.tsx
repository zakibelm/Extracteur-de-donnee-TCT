import React from 'react';
import { ResultCard } from './ResultCard';
import { Button } from './Button';
import { Icons } from './Icons';
import { ExtractedData, Status, TableData, User } from '../types';
import { FinalDocumentView } from './FinalDocumentView';
import { CalendarView } from './CalendarView';
import { ReportView } from './ReportView';

interface MainContentProps {
    activeSection: 'tct' | 'olymel';
    setActiveSection: (section: 'tct' | 'olymel') => void;

    // TCT
    activeTctView: 'extract' | 'document' | 'report';
    setActiveTctView: (view: 'extract' | 'document' | 'report') => void;
    tctExtractedData: ExtractedData[];
    onTctGenerateResults: () => void;
    tctError: string | null;
    tctUnifiedTable: TableData | null;
    onTctTableUpdate: (table: TableData) => void;
    onTctDeleteResult: (id: string) => void;

    // Olymel
    activeOlymelView: 'extract' | 'calendar' | 'report';
    setActiveOlymelView: (view: 'extract' | 'calendar' | 'report') => void;
    olymelExtractedData: ExtractedData[];
    onOlymelGenerateResults: () => void;
    olymelError: string | null;
    olymelUnifiedTable: TableData | null;
    onOlymelTableUpdate: (table: TableData) => void;
    onOlymelDeleteResult: (id: string) => void;

    // Common
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
    user: User | null;
    onLogout: () => void;
}

export const MainContent: React.FC<MainContentProps> = ({
    activeSection,
    setActiveSection,
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
    onLogout
}) => {
    // TCT Logic
    const allTctProcessed = tctExtractedData.length > 0 && tctExtractedData.every(d => d.status === Status.Success || d.status === Status.Error);
    const hasTctSuccessfulExtractions = tctExtractedData.some(d => d.status === Status.Success && d.content);

    // Olymel Logic
    const allOlymelProcessed = olymelExtractedData.length > 0 && olymelExtractedData.every(d => d.status === Status.Success || d.status === Status.Error);
    const hasOlymelSuccessfulExtractions = olymelExtractedData.some(d => d.status === Status.Success);

    const renderTctExtractionView = () => (
        <>
            {tctExtractedData.length === 0 ? (
                <div className="text-center h-full flex flex-col justify-center items-center p-8">
                    <div className="glass-panel p-8 rounded-2xl flex flex-col items-center max-w-lg animate-fadeIn border border-white/5 bg-slate-800/20 backdrop-blur-sm">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                            <Icons.UploadCloud className="w-10 h-10 text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Zone d'Extraction TCT</h2>
                        <p className="text-slate-400">Utilisez le panneau de gauche pour importer vos fichiers (PDF ou Images).</p>
                    </div>
                </div>
            ) : (
                <div className="animate-fadeIn pb-20">
                    {allTctProcessed && hasTctSuccessfulExtractions && (
                        <div className="glass-panel rounded-xl p-6 mb-8 flex items-center justify-between border-l-4 border-l-emerald-500 bg-emerald-500/5">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">Extraction terminée</h3>
                                <p className="text-emerald-200/80 text-sm">Les données ont été extraites avec succès. Vous pouvez maintenant générer le document final.</p>
                            </div>
                            <Button
                                onClick={onTctGenerateResults}
                                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/20 font-semibold"
                            >
                                <Icons.Eye className="mr-2 w-4 h-4" />
                                Voir le Document Final
                            </Button>
                        </div>
                    )}

                    {tctError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center text-red-200 mb-8 backdrop-blur-md flex items-center justify-center gap-2">
                            <Icons.XCircle className="w-5 h-5" />
                            {tctError}
                        </div>
                    )}

                    {tctExtractedData.length > 0 && (
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 ring-1 ring-emerald-500/20">
                                    <Icons.FileText className="w-4 h-4" />
                                </span>
                                Résultats ({tctExtractedData.length})
                            </h2>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {tctExtractedData.map((data, index) => (
                            <div key={data.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-fadeIn">
                                <ResultCard
                                    data={data}
                                    onDelete={() => onTctDeleteResult(data.id)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    const renderOlymelExtractionView = () => (
        <>
            {olymelExtractedData.length === 0 ? (
                <div className="text-center h-full flex flex-col justify-center items-center p-8">
                    <div className="glass-panel p-8 rounded-2xl flex flex-col items-center max-w-lg animate-fadeIn border border-white/5 bg-slate-800/20 backdrop-blur-sm">
                        <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                            <Icons.Truck className="w-10 h-10 text-cyan-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Zone d'Extraction Olymel</h2>
                        <p className="text-slate-400">Utilisez le panneau de gauche pour importer vos manifestes Olymel.</p>
                    </div>
                </div>
            ) : (
                <div className="animate-fadeIn pb-20">
                    {allOlymelProcessed && hasOlymelSuccessfulExtractions && (
                        <div className="glass-panel rounded-xl p-6 mb-8 flex items-center justify-between border-l-4 border-l-cyan-500 bg-cyan-500/5">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">Extraction Olymel terminée</h3>
                                <p className="text-cyan-200/80 text-sm">Prêt à visualiser le calendrier de production.</p>
                            </div>
                            <Button
                                onClick={onOlymelGenerateResults}
                                className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-lg shadow-cyan-500/20 font-semibold"
                            >
                                <Icons.Eye className="mr-2 w-4 h-4" />
                                Ouvrir le Calendrier
                            </Button>
                        </div>
                    )}

                    {olymelError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center text-red-200 mb-8 backdrop-blur-md flex items-center justify-center gap-2">
                            <Icons.XCircle className="w-5 h-5" />
                            {olymelError}
                        </div>
                    )}

                    {olymelExtractedData.length > 0 && (
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 ring-1 ring-cyan-500/20">
                                    <Icons.FileText className="w-4 h-4" />
                                </span>
                                Résultats ({olymelExtractedData.length})
                            </h2>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {olymelExtractedData.map((data, index) => (
                            <div key={data.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-fadeIn">
                                <ResultCard
                                    data={data}
                                    onDelete={() => onOlymelDeleteResult(data.id)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    return (
        <main className="flex-grow p-4 md:p-8 overflow-y-auto custom-scrollbar flex flex-col relative">
            {/* Header avec info utilisateur et déconnexion pour les non-admins */}
            {!user?.isAdmin && (
                <div className="flex justify-between items-center mb-6 p-4 glass-panel rounded-xl border border-white/5 bg-slate-800/40">
                    <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center mr-3 ring-2 ring-emerald-500/30">
                            <Icons.User className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-slate-200">
                            <span className="block text-xs text-slate-400 uppercase font-bold tracking-wider">Conducteur</span>
                            <span className="font-bold text-white">{user?.numDome}</span> <span className="opacity-50 mx-1">|</span> {user?.idEmploye}
                        </span>
                    </div>
                    <Button onClick={onLogout} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm py-2 px-4 rounded-lg transition-colors border border-red-500/20">
                        <Icons.LogOut className="mr-2 w-4 h-4" />
                        Déconnexion
                    </Button>
                </div>
            )}

            {/* Onglets selon la section active */}
            <div className="mb-6 border-b border-white/10 pb-1">
                <nav className="flex space-x-6" aria-label="Tabs">
                    {activeSection === 'tct' ? (
                        <>
                            {user?.isAdmin && (
                                <button
                                    onClick={() => setActiveTctView('extract')}
                                    className={`pb-3 font-medium text-sm transition-all relative ${activeTctView === 'extract'
                                        ? 'text-emerald-400'
                                        : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    <Icons.ScanText className="inline-block mr-2 w-4 h-4" />
                                    Extraction
                                    {activeTctView === 'extract' && (
                                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] rounded-full" />
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => setActiveTctView('document')}
                                disabled={!tctUnifiedTable}
                                className={`pb-3 font-medium text-sm transition-all relative disabled:opacity-30 disabled:cursor-not-allowed ${activeTctView === 'document'
                                    ? 'text-sky-400'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <Icons.Eye className="inline-block mr-2 w-4 h-4" />
                                Document Final
                                {activeTctView === 'document' && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] rounded-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTctView('report')}
                                disabled={!tctUnifiedTable}
                                className={`pb-3 font-medium text-sm transition-all relative disabled:opacity-30 disabled:cursor-not-allowed ${activeTctView === 'report'
                                    ? 'text-amber-400'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <Icons.ClipboardList className="inline-block mr-2 w-4 h-4" />
                                Rapport
                                {activeTctView === 'report' && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] rounded-full" />
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            {user?.isAdmin && (
                                <button
                                    onClick={() => setActiveOlymelView('extract')}
                                    className={`pb-3 font-medium text-sm transition-all relative ${activeOlymelView === 'extract'
                                        ? 'text-cyan-400'
                                        : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    <Icons.ScanText className="inline-block mr-2 w-4 h-4" />
                                    Extraction
                                    {activeOlymelView === 'extract' && (
                                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] rounded-full" />
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => setActiveOlymelView('calendar')}
                                disabled={!olymelUnifiedTable}
                                className={`pb-3 font-medium text-sm transition-all relative disabled:opacity-30 disabled:cursor-not-allowed ${activeOlymelView === 'calendar'
                                    ? 'text-sky-400'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <Icons.ClipboardList className="inline-block mr-2 w-4 h-4" />
                                Calendrier
                                {activeOlymelView === 'calendar' && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] rounded-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveOlymelView('report')}
                                disabled={!olymelUnifiedTable}
                                className={`pb-3 font-medium text-sm transition-all relative disabled:opacity-30 disabled:cursor-not-allowed ${activeOlymelView === 'report'
                                    ? 'text-amber-400'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <Icons.ClipboardList className="inline-block mr-2 w-4 h-4" />
                                Rapport
                                {activeOlymelView === 'report' && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] rounded-full" />
                                )}
                            </button>
                        </>
                    )}
                </nav>
            </div>

            {/* Contenu */}
            <div className="flex-grow min-h-0 relative">
                {activeSection === 'tct' ? (
                    <>
                        {activeTctView === 'extract' && renderTctExtractionView()}
                        {activeTctView === 'document' && (
                            <div className="animate-fadeIn h-full">
                                <FinalDocumentView
                                    tableData={tctUnifiedTable!}
                                    onUpdate={onTctTableUpdate}
                                    onPrint={onPrint}
                                    onDownloadPdf={onDownloadPdf}
                                />
                            </div>
                        )}
                        {activeTctView === 'report' && (
                            <div className="animate-fadeIn h-full">
                                <ReportView
                                    tableData={tctUnifiedTable!}
                                    onPrint={onPrint}
                                    onDownloadPdf={onDownloadPdf}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {activeOlymelView === 'extract' && renderOlymelExtractionView()}
                        {activeOlymelView === 'calendar' && (
                            <div className="animate-fadeIn h-full">
                                <CalendarView
                                    tableData={olymelUnifiedTable!}
                                    onUpdate={onOlymelTableUpdate}
                                />
                            </div>
                        )}
                        {activeOlymelView === 'report' && (
                            <div className="animate-fadeIn h-full">
                                <ReportView
                                    tableData={olymelUnifiedTable!}
                                    onPrint={onPrint}
                                    onDownloadPdf={onDownloadPdf}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            {activeSection === 'tct' && activeTctView === 'extract' && (
                <footer className="text-center p-4 mt-8 text-slate-600 text-[10px] uppercase tracking-widest opacity-50">
                    <p>Propulsé par Zakibelm • ADT v2.0</p>
                </footer>
            )}
        </main>
    );
};
