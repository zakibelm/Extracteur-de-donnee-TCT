
import React from 'react';
import { FileUploader } from './FileUploader';
import { Button } from './Button';
import { Icons } from './Icons';
import { Status } from '../types';
import { User } from './AuthPage';

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    files: File[];
    onFileChange: (files: File[]) => void;
    onExtractData: () => void;
    globalStatus: Status;
    user?: User;
    onLogout?: () => void;
    onRemoveFile: (fileName: string) => void;
    isAdmin: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    setIsSidebarOpen,
    files,
    onFileChange,
    onExtractData,
    globalStatus,
    user,
    onLogout,
    onRemoveFile,
    isAdmin
}) => {
    return (
        <aside className={`relative bg-slate-800 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-96 border-r border-slate-700' : 'w-0 border-none'}`}>
            <div className={`flex-grow overflow-y-auto flex flex-col transition-all duration-300 whitespace-nowrap ${isSidebarOpen ? 'p-4 opacity-100 visible' : 'p-0 opacity-0 invisible w-0 overflow-hidden'}`}>
                <header className="flex items-center gap-4 mb-8 justify-start">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-2xl font-bold text-white">ADT</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                            ADT
                        </h1>
                        <p className="text-sm text-slate-400">Extracteur de Données</p>
                    </div>
                </header>
                
                {isAdmin ? (
                    <>
                        <FileUploader onFileChange={onFileChange} files={files} onRemoveFile={onRemoveFile} />
                        {files.length > 0 && (
                            <div className="mt-8">
                                <Button
                                    onClick={onExtractData}
                                    disabled={globalStatus === Status.Processing}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {globalStatus === Status.Processing ? (
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
                     <div className="flex flex-col items-center justify-center text-center p-6 border border-slate-700 rounded-lg bg-slate-800/50">
                        <Icons.User className="w-12 h-12 text-sky-500 mb-3" />
                        <h3 className="text-lg font-semibold text-slate-200">Mode Consultation</h3>
                        <p className="text-sm text-slate-400 mt-2">
                            Vous êtes connecté en tant qu'utilisateur standard.
                            Les fonctionnalités d'importation sont réservées à l'administrateur.
                        </p>
                    </div>
                )}

                {/* User Section at Bottom */}
                <div className="mt-auto pt-6 border-t border-slate-700">
                    <div className="bg-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-bold">
                                {user?.numDome.substring(0, 2)}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-slate-200 truncate">Dôme: {user?.numDome}</p>
                                <p className="text-xs text-slate-400 truncate">ID: {user?.idEmploye}</p>
                                {isAdmin && <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">Admin</span>}
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
                </div>
            </div>

            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="absolute -right-3 top-20 bg-slate-700 hover:bg-emerald-600 text-slate-200 rounded-full p-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors z-10 overflow-visible shadow-lg"
                aria-label={isSidebarOpen ? "Réduire la barre latérale" : "Agrandir la barre latérale"}
            >
                {isSidebarOpen ? <Icons.ChevronLeft className="w-5 h-5" /> : <Icons.ChevronRight className="w-5 h-5" />}
            </button>
        </aside>
    );
};
