
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
    onBackup: () => void;
    onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
    isAdmin,
    onBackup,
    onRestore
}) => {
    return (
        <aside className={`relative bg-slate-800 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-96 border-r border-slate-700' : 'w-0 border-none'}`}>
            <div className={`flex-grow overflow-y-auto flex flex-col transition-all duration-300 whitespace-nowrap ${isSidebarOpen ? 'p-4 opacity-100 visible' : 'p-0 opacity-0 invisible w-0 overflow-hidden'}`}>
                <header className="flex items-center gap-4 mb-6 justify-start">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-2xl font-bold text-white">ADT</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                            ADT
                        </h1>
                        <p className="text-sm text-slate-400">Assistant de Données</p>
                    </div>
                </header>
                
                {isAdmin ? (
                    <>
                        {/* SECTION PRINCIPALE : IMPORT IMAGES */}
                        <div className="mb-2">
                            <h3 className="text-xs font-bold text-slate-300 uppercase mb-2 flex items-center">
                                <Icons.UploadCloud className="w-4 h-4 mr-1 text-emerald-400" />
                                1. Importation Documents
                            </h3>
                            <FileUploader onFileChange={onFileChange} files={files} onRemoveFile={onRemoveFile} />
                        </div>

                        {files.length > 0 && (
                            <div className="mt-4 mb-6">
                                <Button
                                    onClick={onExtractData}
                                    disabled={globalStatus === Status.Processing}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-900/20"
                                >
                                    {globalStatus === Status.Processing ? (
                                        <>
                                            <Icons.Loader className="animate-spin mr-2" />
                                            Traitement en cours...
                                        </>
                                    ) : (
                                        <>
                                            <Icons.Sparkles className="mr-2" />
                                            2. Lancer l'Extraction
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                        
                        <div className="flex-grow"></div>

                        {/* SECTION SECONDAIRE : SAUVEGARDE (BAS DE PAGE) */}
                        <div className="mt-8 border-t border-slate-700 pt-4 opacity-80 hover:opacity-100 transition-opacity">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 px-1 flex items-center">
                                <Icons.Lock className="w-3 h-3 mr-1" />
                                Outils Système (Sauvegarde)
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <Button onClick={onBackup} className="bg-slate-700 hover:bg-slate-600 text-[10px] py-2 px-2 border border-slate-600 justify-center h-auto">
                                    <div className="flex flex-col items-center gap-1">
                                        <Icons.Download className="w-4 h-4 text-sky-400" /> 
                                        <span>Sauvegarder</span>
                                    </div>
                                </Button>
                                <label className="flex flex-col items-center justify-center px-2 py-2 border border-slate-600 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-medium rounded-md cursor-pointer transition-colors shadow-sm h-auto text-center">
                                    <Icons.Upload className="w-4 h-4 text-emerald-400 mb-1" /> 
                                    Restaurer
                                    <input type="file" onChange={onRestore} className="hidden" accept=".json" />
                                </label>
                            </div>
                        </div>
                    </>
                ) : (
                     <div className="flex flex-col items-center justify-center text-center p-6 border border-slate-700 rounded-lg bg-slate-800/50">
                        <Icons.User className="w-12 h-12 text-sky-500 mb-3" />
                        <h3 className="text-lg font-semibold text-slate-200">Mode Utilisateur</h3>
                        <p className="text-xs text-slate-400 mt-2 mb-4">
                            Consultez et modifiez les tournées qui vous sont assignées.
                        </p>
                        
                        <div className="w-full border-t border-slate-700 pt-4 mt-4">
                            <p className="text-[10px] text-slate-500 mb-2">Besoin de récupérer le tableau ?</p>
                            <label className="flex items-center justify-center w-full px-4 py-2 border border-slate-600 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-md cursor-pointer transition-colors shadow-sm">
                                <Icons.Upload className="mr-2 w-4 h-4 text-emerald-400" /> 
                                Ouvrir une Sauvegarde
                                <input type="file" onChange={onRestore} className="hidden" accept=".json" />
                            </label>
                        </div>
                    </div>
                )}

                {/* User Section at Bottom */}
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="bg-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                                {user?.numDome.substring(0, 2)}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-slate-200 truncate">Dôme: {user?.numDome}</p>
                                {isAdmin && <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">Admin</span>}
                            </div>
                        </div>
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
