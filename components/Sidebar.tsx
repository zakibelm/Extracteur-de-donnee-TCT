
import React from 'react';
import { FileUploader } from './FileUploader';
import { Button } from './Button';
import { Icons } from './Icons';
import { Status } from '../types';
import { User } from './AuthPage';

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    // TCT
    tctFiles: File[];
    onTctFileChange: (files: File[]) => void;
    onTctExtractData: () => void;
    tctGlobalStatus: Status;
    // Olymel
    olymelFiles: File[];
    onOlymelFileChange: (files: File[]) => void;
    onOlymelExtractData: () => void;
    olymelGlobalStatus: Status;
    // Commun
    user?: User;
    onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    setIsSidebarOpen,
    tctFiles,
    onTctFileChange,
    onTctExtractData,
    tctGlobalStatus,
    olymelFiles,
    onOlymelFileChange,
    onOlymelExtractData,
    olymelGlobalStatus,
    user,
    onLogout
}) => {
    const [activeSection, setActiveSection] = React.useState<'tct' | 'olymel'>('tct');

    const currentFiles = activeSection === 'tct' ? tctFiles : olymelFiles;
    const currentOnFileChange = activeSection === 'tct' ? onTctFileChange : onOlymelFileChange;
    const currentOnExtractData = activeSection === 'tct' ? onTctExtractData : onOlymelExtractData;
    const currentGlobalStatus = activeSection === 'tct' ? tctGlobalStatus : olymelGlobalStatus;

    return (
        <aside className={`relative bg-slate-800 border-r border-slate-700 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-96' : 'w-20'}`}>
            <div className="flex-grow p-4 overflow-y-auto flex flex-col">
                <header className={`flex items-center gap-4 mb-8 ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}>
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-2xl font-bold text-white">ADT</span>
                    </div>
                    {isSidebarOpen && (
                        <div>
                            <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                                ADT
                            </h1>
                            <p className="text-sm text-slate-400">Taxi Coop Terrebonne</p>
                        </div>
                    )}
                </header>

                {isSidebarOpen ? (
                    <>
                        {/* Section Tabs */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setActiveSection('tct')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${activeSection === 'tct'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                TCT
                            </button>
                            <button
                                onClick={() => setActiveSection('olymel')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${activeSection === 'olymel'
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                Olymel
                            </button>
                        </div>

                        <FileUploader onFileChange={currentOnFileChange} />
                        {currentFiles.length > 0 && (
                            <div className="mt-8">
                                <Button
                                    onClick={currentOnExtractData}
                                    disabled={currentGlobalStatus === Status.Processing}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {currentGlobalStatus === Status.Processing ? (
                                        <>
                                            <Icons.Loader className="animate-spin mr-2" />
                                            Traitement...
                                        </>
                                    ) : (
                                        <>
                                            <Icons.Sparkles className="mr-2" />
                                            Lancer l'Extraction
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        {/* You can add smaller icons here as shortcuts when collapsed */}
                    </div>
                )}

                {/* User Section at Bottom */}
                <div className="mt-auto pt-6 border-t border-slate-700">
                    {isSidebarOpen ? (
                        <div className="bg-slate-700/50 rounded-lg p-3">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-bold">
                                    {user?.numDome.substring(0, 2)}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-slate-200 truncate">Dôme: {user?.numDome}</p>
                                    <p className="text-xs text-slate-400 truncate">ID: {user?.idEmploye}</p>
                                </div>
                            </div>
                            <button
                                onClick={onLogout}
                                className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                            >
                                <Icons.LogOut className="w-4 h-4 mr-2" />
                                Se déconnecter
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onLogout}
                            className="w-full flex justify-center p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                            title="Se déconnecter"
                        >
                            <Icons.LogOut className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-700 hover:bg-emerald-600 text-slate-200 rounded-full p-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors z-10"
                aria-label={isSidebarOpen ? "Réduire la barre latérale" : "Agrandir la barre latérale"}
            >
                {isSidebarOpen ? <Icons.ChevronLeft className="w-5 h-5" /> : <Icons.ChevronRight className="w-5 h-5" />}
            </button>
        </aside>
    );
};