
import React from 'react';
import { ResultCard } from './ResultCard';
import { Button } from './Button';
import { Icons } from './Icons';
import { ExtractedData, Status, TableData } from '../types';
import { FinalDocumentView } from './FinalDocumentView';
import { CalendarView } from './CalendarView';
import { User } from './AuthPage';
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
                <div className="text-center h-full flex flex-col justify-center items-center">
                    <Icons.UploadCloud className="w-16 h-16 text-slate-600 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-400">Commencez par téléverser des fichiers TCT</h2>
                    <p className="text-slate-500 mt-2">Utilisez le panneau de gauche (accordéon TCT) pour ajouter des images ou des PDFs.</p>
                </div>
            ) : (
                <div>
                    {allTctProcessed && hasTctSuccessfulExtractions && (
                        <div className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700 flex items-center justify-between">
                            <p className="text-slate-300">L'extraction TCT est terminée. Prêt à voir les résultats consolidés ?</p>
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

                    <h2 className="text-2xl font-bold text-center mb-8 text-slate-300">Extraction TCT par Fichier</h2>
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
                <div className="text-center h-full flex flex-col justify-center items-center">
                    <Icons.UploadCloud className="w-16 h-16 text-slate-600 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-400">Commencez par téléverser des fichiers Olymel</h2>
                    <p className="text-slate-500 mt-2">Utilisez le panneau de gauche (accordéon Olymel) pour ajouter des images ou des PDFs.</p>
                </div>
            ) : (
                <div>
                    {allOlymelProcessed && hasOlymelSuccessfulExtractions && (
                        <div className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700 flex items-center justify-between">
                            <p className="text-slate-300">L'extraction Olymel est terminée. Prêt à voir le calendrier ?</p>
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

                    <h2 className="text-2xl font-bold text-center mb-8 text-slate-300">Extraction Olymel par Fichier</h2>
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

                {/* Sélecteur de section (TCT / Olymel) */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setActiveSection('tct')}
                        className={`flex-1 px-6 py-4 rounded-lg font-bold text-lg transition-all ${activeSection === 'tct'
                                ? 'bg-emerald-600 text-white shadow-lg'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        <Icons.ScanText className="inline-block mr-2 w-6 h-6" />
                        TCT
                    </button>
                    <button
                        onClick={() => setActiveSection('olymel')}
                        className={`flex-1 px-6 py-4 rounded-lg font-bold text-lg transition-all ${activeSection === 'olymel'
                                ? 'bg-cyan-600 text-white shadow-lg'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        <Icons.ScanText className="inline-block mr-2 w-6 h-6" />
                        Olymel
                    </button>
                </div>

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
