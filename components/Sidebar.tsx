
import React from 'react';
import { FileUploader } from './FileUploader';
import { Button } from './Button';
import { Icons } from './Icons';
import { Status, User } from '../types';

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    files: File[];
    onFileChange: (files: File[]) => void;
    onExtractData: () => void;
    globalStatus: Status;
    user?: User;
    onRemoveFile: (fileName: string) => void;
    isAdmin: boolean;
    onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    setIsSidebarOpen,
    files,
    onFileChange,
    onExtractData,
    globalStatus,
    user,
    onRemoveFile,
    isAdmin,
    onOpenSettings
}) => {
    return (
        <aside 
            className={`
                fixed lg:relative z-50 h-full bg-zinc-950 flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none
                ${isSidebarOpen ? 'w-[280px] md:w-80 border-r border-zinc-800 translate-x-0' : 'w-0 border-none -translate-x-full lg:translate-x-0'}
            `}
        >
            <div className={`flex-grow overflow-y-auto flex flex-col transition-all duration-300 whitespace-nowrap custom-scrollbar ${isSidebarOpen ? 'p-6 opacity-100 visible' : 'p-0 opacity-0 invisible w-0 overflow-hidden'}`}>
                <header className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center shadow-[0_5px_20px_rgba(225,29,72,0.4)] flex-shrink-0">
                        <Icons.Database className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tighter italic">ADT Logistics</h1>
                        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Module IA Haute-Précision</p>
                    </div>
                </header>
                
                {isAdmin ? (
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center">
                                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2"></span>
                                    Importation
                                </h3>
                                <button 
                                    onClick={onOpenSettings}
                                    className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-500 rounded-lg transition-colors"
                                    title="Paramètres IA"
                                >
                                    <Icons.Settings className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <FileUploader onFileChange={onFileChange} files={files} onRemoveFile={onRemoveFile} />
                        </div>

                        {files.length > 0 && (
                            <Button
                                onClick={onExtractData}
                                disabled={globalStatus === Status.Processing}
                                className="w-full bg-red-600 hover:bg-red-500 shadow-xl shadow-red-900/20 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-[0.98]"
                            >
                                {globalStatus === Status.Processing ? (
                                    <Icons.Loader className="animate-spin mr-2" />
                                ) : (
                                    <Icons.Sparkles className="mr-2 w-4 h-4" />
                                )}
                                {globalStatus === Status.Processing ? "Traitement..." : "Extraire les données"}
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="p-6 border border-zinc-800 rounded-3xl bg-zinc-900/50 text-center">
                        <Icons.User className="w-10 h-10 text-red-500 mx-auto mb-3" />
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Mode Consultation</p>
                    </div>
                )}

                <div className="mt-auto pt-6 border-t border-zinc-800 flex flex-col gap-4">
                    <div className="bg-zinc-900/80 p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-black text-xs">
                            {user?.numDome.substring(0, 2)}
                        </div>
                        <div className="overflow-hidden flex-grow">
                            <p className="text-xs font-black text-white truncate">Dôme {user?.numDome}</p>
                            <span className="text-[8px] uppercase font-bold text-zinc-500">Super Admin</span>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="hidden lg:block absolute -right-3 top-24 bg-zinc-800 hover:bg-red-600 text-white rounded-full p-1.5 shadow-xl transition-all z-10"
            >
                {isSidebarOpen ? <Icons.ChevronLeft className="w-4 h-4" /> : <Icons.ChevronRight className="w-4 h-4" />}
            </button>
        </aside>
    );
};
