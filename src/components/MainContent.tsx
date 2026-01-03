
import React from 'react';
import { ResultCard } from './ResultCard';
import { Button } from './Button';
import { Icons } from './Icons';
import { ExtractedData, Status, TableData } from '../types';
import { FinalDocumentView } from './FinalDocumentView';
import { CalendarView } from './CalendarView';
import { User } from './AuthPage';
import { ReportView } from './ReportView';
import { SettingsPage } from './SettingsPage';

interface MainContentProps {
    activeSection: 'tct' | 'olymel' | 'settings';
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
    const hasOlymelSuccessfulExtractions = olymelExtractedData.some(d => d.status === Status.Success);

    const renderTctExtractionView = () => (
        <>
            {tctExtractedData.length === 0 ? (
                <div className="text-center h-full flex flex-col justify-center items-center">
                    <Icons.UploadCloud className="w-12 h-12 text-slate-600 mb-3" />
                    <h2 className="text-lg font-bold text-slate-400">Commencez par téléverser des fichiers TCT</h2>
                    <p className="text-slate-500 mt-1.5 text-sm">Utilisez le panneau de gauche (accordéon TCT) pour ajouter des images ou des PDFs.</p>
                </div>
            ) : (
                <div>
                    {allTctProcessed && hasTctSuccessfulExtractions && (
                        <div className="bg-slate-800 rounded-lg p-3 mb-4 border border-slate-700 flex items-center justify-between">
                            <p className="text-slate-300 text-sm">L'extraction TCT est terminée. Prêt à voir les résultats consolidés ?</p>
                            <Button
                                onClick={onTctGenerateResults}
                                className="bg-sky-600 hover:bg-sky-700"
                            >
                                <Icons.Eye className="mr-2" />
                                Ouvrir le Document Final
                            </Button>
                        </div>
                    )}

                    {tctError && <p className="text-red-400 my-4 text-center p-4 bg-red-900/20 border border-red-500/30 rounded-md">{tctError}</p>}

                    <h2 className="text-base font-bold text-center mb-4 text-slate-300">Extraction TCT par Fichier</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
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
                <div className="text-center h-full flex flex-col justify-center items-center">
                    <Icons.UploadCloud className="w-12 h-12 text-slate-600 mb-3" />
                    <h2 className="text-lg font-bold text-slate-400">Commencez par téléverser des fichiers Olymel</h2>
                    <p className="text-slate-500 mt-1.5 text-sm">Utilisez le panneau de gauche (accordéon Olymel) pour ajouter des images ou des PDFs.</p>
                </div>
            ) : (
                <div>
                    {allOlymelProcessed && hasOlymelSuccessfulExtractions && (
                        <div className="bg-slate-800 rounded-lg p-3 mb-4 border border-slate-700 flex items-center justify-between">
                            <p className="text-slate-300 text-sm">L'extraction Olymel est terminée. Prêt à voir le calendrier ?</p>
                            <Button
                                onClick={onOlymelGenerateResults}
                                className="bg-cyan-600 hover:bg-cyan-700"
                            >
                                <Icons.Eye className="mr-2" />
                                Ouvrir le Calendrier
                            </Button>
                        </div>
                    )}

                    {olymelError && <p className="text-red-400 my-4 text-center p-4 bg-red-900/20 border border-red-500/30 rounded-md">{olymelError}</p>}

                    <h2 className="text-base font-bold text-center mb-4 text-slate-300">Extraction Olymel par Fichier</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
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
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117.65%', height: '117.65%' }}>
            <div className="flex-1 flex flex-col p-3 md:p-4 overflow-hidden">
                {/* Header avec info utilisateur et déconnexion pour les non-admins */}
                {!user?.isAdmin && (
                    <div className="flex-none flex justify-between items-center mb-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex items-center">
                            <Icons.User className="w-4 h-4 mr-2 text-slate-400" />
                            <span className="text-slate-300 text-sm">
                                <span className="font-semibold">{user?.numDome}</span> - {user?.idEmploye}
                            </span>
                        </div>
                        <Button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-xs py-1.5 px-3">
                            <Icons.LogOut className="mr-1.5 w-3.5 h-3.5" />
                            Déconnexion
                        </Button>
                    </div>
                )}

                {/* Sélecteur de section (TCT / Olymel) - Caché si paramètres */}
                {activeSection !== 'settings' && (
                    <div className="flex-none flex gap-3 mb-4">
                        <button
                            onClick={() => setActiveSection('tct')}
                            className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${activeSection === 'tct'
                                ? 'bg-emerald-600 text-white shadow-lg'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            <Icons.ScanText className="inline-block mr-2 w-4 h-4" />
                            TCT
                        </button>
                        <button
                            onClick={() => setActiveSection('olymel')}
                            className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${activeSection === 'olymel'
                                ? 'bg-cyan-600 text-white shadow-lg'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            <Icons.Truck className="inline-block mr-2 w-4 h-4" />
                            Olymel
                        </button>
                    </div>
                )}

                {/* Onglets selon la section active */}
                {activeSection !== 'settings' && (
                    <div className="flex-none border-b border-slate-700 mb-3">
                        <nav className="flex space-x-3" aria-label="Tabs">
                        {activeSection === 'tct' ? (
                            <>
                                {/* Onglets TCT */}
                                {user?.isAdmin && (
                                    <button
                                        onClick={() => setActiveTctView('extract')}
                                        className={`px-3 py-2 font-medium text-xs rounded-t-md ${activeTctView === 'extract' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <Icons.ScanText className="inline-block mr-1.5 w-4 h-4" />
                                        Extraction
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveTctView('document')}
                                    disabled={!tctUnifiedTable}
                                    className={`px-3 py-2 font-medium text-xs rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeTctView === 'document' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Icons.Eye className="inline-block mr-1.5 w-4 h-4" />
                                    Document Final
                                </button>
                                <button
                                    onClick={() => setActiveTctView('report')}
                                    disabled={!tctUnifiedTable}
                                    className={`px-3 py-2 font-medium text-xs rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeTctView === 'report' ? 'border-b-2 border-amber-400 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Icons.ClipboardList className="inline-block mr-1.5 w-4 h-4" />
                                    Rapport
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Onglets Olymel */}
                                {user?.isAdmin && (
                                    <button
                                        onClick={() => setActiveOlymelView('extract')}
                                        className={`px-3 py-2 font-medium text-xs rounded-t-md ${activeOlymelView === 'extract' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <Icons.ScanText className="inline-block mr-1.5 w-4 h-4" />
                                        Extraction
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveOlymelView('calendar')}
                                    disabled={!olymelUnifiedTable}
                                    className={`px-3 py-2 font-medium text-xs rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeOlymelView === 'calendar' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Icons.ClipboardList className="inline-block mr-1.5 w-4 h-4" />
                                    Calendrier
                                </button>
                                <button
                                    onClick={() => setActiveOlymelView('report')}
                                    disabled={!olymelUnifiedTable}
                                    className={`px-3 py-2 font-medium text-xs rounded-t-md disabled:cursor-not-allowed disabled:text-slate-600 ${activeOlymelView === 'report' ? 'border-b-2 border-amber-400 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <Icons.ClipboardList className="inline-block mr-1.5 w-4 h-4" />
                                    Rapport
                                </button>
                            </>
                        )}
                    </nav>
                </div>
                )}

                {/* Contenu selon section et vue active - Scrollable */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {activeSection === 'settings' ? (
                        <SettingsPage />
                    ) : activeSection === 'tct' ? (
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
                    <footer className="flex-none text-center p-2 mt-3 text-slate-500 text-xs">
                        <p>Propulsé par Zakibelm</p>
                    </footer>
                )}
            </div>
        </main>
    );
};
