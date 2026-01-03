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

    // Commun
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
    user: User;
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
    onLogout,
}) => {

    // TCT
    const allTctProcessed = tctExtractedData.length > 0 && tctExtractedData.every(d => d.status === Status.Success || d.status === Status.Error);
    const hasTctSuccessfulExtractions = tctExtractedData.some(d => d.status === Status.Success && d.content && d.content.rows.length > 0);

    // Olymel
    const allOlymelProcessed = olymelExtractedData.length > 0 && olymelExtractedData.every(d => d.status === Status.Success || d.status === Status.Error);
    const hasOlymelSuccessfulExtractions = olymelExtractedData.some(d => d.status === Status.Success && d.content && d.content.rows.length > 0);

    const renderTctExtractionView = () => (
        <>
            {tctExtractedData.length === 0 ? (
                <div className="text-center h-full flex flex-col justify-center items-center p-8">
                    <div className="glass-panel p-8 rounded-2xl flex flex-col items-center max-w-lg animate-fadeIn">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-emerald-500/20">
                            <Icons.UploadCloud className="w-10 h-10 text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">Zone d'Extraction TCT</h2>
                        <p className="text-slate-400">Utilisez le panneau de gauche pour importer vos fichiers (PDF ou Images).</p>
                    </div>
                </div>
            ) : (
                <div className="animate-fadeIn">
                    {allTctProcessed && hasTctSuccessfulExtractions && (
                        <div className="glass-panel rounded-xl p-6 mb-8 flex items-center justify-between border-l-4 border-l-emerald-500">
                            <div>
                                <h3 className="text-lg font-bold text-white">Extraction terminée</h3>
                                <p className="text-slate-400 text-sm">Toutes les données TCT ont été traitées avec succès.</p>
                            </div>
                            <Button
                                onClick={onTctGenerateResults}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                            >
                                <Icons.Eye className="mr-2" />
                                Voir le Document Final
                            </Button>
                        </div>
                    )}

                    {tctError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center text-red-200 mb-8 backdrop-blur-md">
                            <Icons.AlertTriangle className="inline-block mr-2 w-5 h-5" />
                            {tctError}
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">Fichiers Traités</h2>
                        <span className="text-sm text-slate-400 bg-white/5 py-1 px-3 rounded-full border border-white/5">
                            {tctExtractedData.length} fichier{tctExtractedData.length > 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {tctExtractedData.map((data) => (
                            <ResultCard
                                key={data.id}
                                data={data}
                                onDelete={onTctDeleteResult}
                            />
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
                    <div className="glass-panel p-8 rounded-2xl flex flex-col items-center max-w-lg animate-fadeIn">
                        <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-cyan-500/20">
                            <Icons.Truck className="w-10 h-10 text-cyan-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">Zone d'Extraction Olymel</h2>
                        <p className="text-slate-400">Utilisez le panneau de gauche pour importer vos manifestes Olymel.</p>
                    </div>
                </div>
            ) : (
                <div className="animate-fadeIn">
                    {allOlymelProcessed && hasOlymelSuccessfulExtractions && (
                        <div className="glass-panel rounded-xl p-6 mb-8 flex items-center justify-between border-l-4 border-l-cyan-500">
                            <div>
                                <h3 className="text-lg font-bold text-white">Extraction Olymel terminée</h3>
                                <p className="text-slate-400 text-sm">Les manifestes ont été analysés.</p>
                            </div>
                            <Button
                                onClick={onOlymelGenerateResults}
                                className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                            >
                                <Icons.Eye className="mr-2" />
                                Ouvrir le Calendrier
                            </Button>
                        </div>
                    )}

                    {olymelError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center text-red-200 mb-8 backdrop-blur-md">
                            <Icons.AlertTriangle className="inline-block mr-2 w-5 h-5" />
                            {olymelError}
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">Manifestes Olymel</h2>
                        <span className="text-sm text-slate-400 bg-white/5 py-1 px-3 rounded-full border border-white/5">
                            {olymelExtractedData.length} fichier{olymelExtractedData.length > 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {olymelExtractedData.map((data) => (
                            <ResultCard
                                key={data.id}
                                data={data}
                                onDelete={onOlymelDeleteResult}
                            />
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    return (
        <main className="flex-grow p-4 md:p-8 overflow-y-auto flex flex-col">
            <div className="max-w-7xl mx-auto w-full flex flex-col flex-grow">
                {/* Header avec info utilisateur et déconnexion pour les non-admins */}
                {!user?.isAdmin && (
                    <div className="flex justify-between items-center mb-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex items-center">
                            <Icons.User className="w-5 h-5 mr-2 text-slate-400" />
                            <span className="text-slate-300">
                                <span className="font-semibold">{user?.numDome}</span> - {user?.idEmploye}
                            </span>
                        </div>
                        <Button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-sm py-2 px-3">
                            <Icons.LogOut className="mr-2" />
                            Déconnexion
                        </Button>
                    </div>
                )}

                {/* Sélecteur de section (TCT / Olymel) - REMOVED (Handled by Sidebar) */}

                {/* Onglets selon la section active */}
                <div className="border-b border-slate-700 mb-4">
                    <nav className="flex space-x-4" aria-label="Tabs">
                        {activeSection === 'tct' ? (
                            <>
                                {/* Onglets TCT */}
                                {user?.isAdmin && (
                                    <button
                                        onClick={() => setActiveTctView('extract')}
                                        className={`px-3 py-2 font-medium text-sm rounded-t-md ${activeTctView === 'extract' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <Icons.ScanText className="inline-block mr-2 w-5 h-5" />
                                        Extraction
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveTctView('document')}
                                    disabled={!tctUnifiedTable}
                                    className={`px-3 py-2 font-medium text-sm rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeTctView === 'document' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Icons.Eye className="inline-block mr-2 w-5 h-5" />
                                    Document Final
                                </button>
                                <button
                                    onClick={() => setActiveTctView('report')}
                                    disabled={!tctUnifiedTable}
                                    className={`px-3 py-2 font-medium text-sm rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeTctView === 'report' ? 'border-b-2 border-amber-400 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Icons.ClipboardList className="inline-block mr-2 w-5 h-5" />
                                    Rapport
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Onglets Olymel */}
                                {user?.isAdmin && (
                                    <button
                                        onClick={() => setActiveOlymelView('extract')}
                                        className={`px-3 py-2 font-medium text-sm rounded-t-md ${activeOlymelView === 'extract' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <Icons.ScanText className="inline-block mr-2 w-5 h-5" />
                                        Extraction
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveOlymelView('calendar')}
                                    disabled={!olymelUnifiedTable}
                                    className={`px-3 py-2 font-medium text-sm rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeOlymelView === 'calendar' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Icons.ClipboardList className="inline-block mr-2 w-5 h-5" />
                                    Calendrier
                                </button>
                                <button
                                    onClick={() => setActiveOlymelView('report')}
                                    disabled={!olymelUnifiedTable}
                                    className={`px-3 py-2 font-medium text-sm rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeOlymelView === 'report' ? 'border-b-2 border-amber-400 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Icons.ClipboardList className="inline-block mr-2 w-5 h-5" />
                                    Rapport
                                </button>
                            </>
                        )}
                    </nav>
                </div>

                {/* Contenu selon section et vue active */}
                <div className="flex-grow">
                    {activeSection === 'tct' ? (
                        <>
                            {activeTctView === 'extract' && renderTctExtractionView()}
                            {activeTctView === 'document' && (
                                <FinalDocumentView
                                    tableData={tctUnifiedTable}
                                    onPrint={onPrint}
                                    onDownloadPdf={onDownloadPdf}
                                    onTableUpdate={onTctTableUpdate}
                                    user={user}
                                />
                            )}
                            {activeTctView === 'report' && (
                                <ReportView
                                    tableData={tctUnifiedTable}
                                    onPrint={onPrint}
                                    onDownloadPdf={onDownloadPdf}
                                />
                            )}
                        </>
                    ) : (
                        <>
                            {activeOlymelView === 'extract' && renderOlymelExtractionView()}
                            {activeOlymelView === 'calendar' && (
                                <CalendarView
                                    tableData={olymelUnifiedTable}
                                    onPrint={onPrint}
                                    onDownloadPdf={onDownloadPdf}
                                    user={user}
                                />
                            )}
                            {activeOlymelView === 'report' && (
                                <ReportView
                                    tableData={olymelUnifiedTable}
                                    onPrint={onPrint}
                                    onDownloadPdf={onDownloadPdf}
                                />
                            )}
                        </>
                    )}
                </div>

                {activeSection === 'tct' && activeTctView === 'extract' && (
                    <footer className="text-center p-4 mt-8 text-slate-500 text-sm">
                        <p>Propulsé par Zakibelm</p>
                    </footer>
                )}
            </div>
        </main>
    );
};
