
import React, { useState } from 'react';
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
    isTctOpen: boolean;
    setIsTctOpen: (isOpen: boolean) => void;
    // Olymel
    olymelFiles: File[];
    onOlymelFileChange: (files: File[]) => void;
    onOlymelExtractData: () => void;
    olymelGlobalStatus: Status;
    isOlymelOpen: boolean;
    setIsOlymelOpen: (isOpen: boolean) => void;
    olymelChangeEventCount: number;
    // Commun
    user?: User;
    onLogout?: () => void;
    onSectionChange: (section: 'tct' | 'olymel') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    setIsSidebarOpen,
    tctFiles,
    onTctFileChange,
    onTctExtractData,
    tctGlobalStatus,
    isTctOpen,
    setIsTctOpen,
    olymelFiles,
    onOlymelFileChange,
    onOlymelExtractData,
    olymelGlobalStatus,
    isOlymelOpen,
    setIsOlymelOpen,
    olymelChangeEventCount,
    user,
    onLogout,
    onSectionChange
}) => {
    // Accordion states are now controlled by parent (App.tsx) for persistence


    return (
        <aside className={`relative bg-slate-800 border-r border-slate-700 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-72' : 'w-16'}`}>
            <div className="flex-grow p-3 overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-slate-600">
                <header className={`flex items-center gap-3 mb-4 ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}>
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-lg font-bold text-white">ADT</span>
                    </div>
                    {isSidebarOpen && (
                        <div>
                            <h1 className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                                ADT
                            </h1>
                            <p className="text-xs text-slate-400">Taxi Coop Terrebonne</p>
                        </div>
                    )}
                </header>

                {isSidebarOpen ? (
                    <div className="flex flex-col gap-3">
                        {/* ================= ACCORDEON TCT ================= */}
                        <div className="border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden">
                            <button
                                onClick={() => {
                                    setIsTctOpen(!isTctOpen);
                                    if (!isTctOpen) onSectionChange('tct');
                                }}
                                className={`w-full flex items-center justify-between p-2.5 text-sm font-semibold transition-colors ${isTctOpen ? 'bg-emerald-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icons.FileText className="w-4 h-4" />
                                    <span>Extraction TCT</span>
                                </div>
                                {isTctOpen ? <Icons.ChevronDown className="w-3.5 h-3.5" /> : <Icons.ChevronRight className="w-3.5 h-3.5" />}
                            </button>

                            <div className={`${isTctOpen ? 'block' : 'hidden'} p-2.5 border-t border-slate-700`}>
                                <div className="mb-3">
                                    <FileUploader id="uploader-tct" onFileChange={onTctFileChange} showFileList={false} />
                                </div>

                                {/* LISTE DES FICHIERS UPLOADÉS TCT - TRÈS VISIBLE */}
                                {tctFiles.length > 0 && (
                                    <div className="mb-3 p-3 bg-green-900/30 border-2 border-green-500 rounded-lg">
                                        <h4 className="text-green-200 font-bold text-sm mb-1.5">
                                            📁 Fichiers TCT uploadés ({tctFiles.length})
                                        </h4>
                                        <ul className="space-y-0.5">
                                            {tctFiles.map((file, index) => (
                                                <li key={index} className="text-green-100 text-xs flex items-center gap-1.5">
                                                    <span className="text-green-400">✓</span>
                                                    <span className="font-mono truncate">{file.name}</span>
                                                    <span className="text-green-400 text-[10px]">
                                                        ({(file.size / 1024).toFixed(1)} KB)
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {tctFiles.length > 0 && (
                                    <Button
                                        onClick={onTctExtractData}
                                        disabled={tctGlobalStatus === Status.Processing}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-md transform hover:scale-[1.02] transition-all"
                                    >
                                        {tctGlobalStatus === Status.Processing ? (
                                            <>
                                                <Icons.Loader className="animate-spin mr-2" />
                                                Traitement TCT...
                                            </>
                                        ) : (
                                            <>
                                                <Icons.Sparkles className="mr-2" />
                                                Lancer TCT ({tctFiles.length} fichier{tctFiles.length > 1 ? 's' : ''})
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* ================= ACCORDEON OLYMEL ================= */}
                        <div className="border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden">
                            <button
                                onClick={() => {
                                    setIsOlymelOpen(!isOlymelOpen);
                                    if (!isOlymelOpen) onSectionChange('olymel');
                                }}
                                className={`w-full flex items-center justify-between p-2.5 text-sm font-semibold transition-colors ${isOlymelOpen ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icons.Truck className="w-4 h-4" />
                                    <span>Extraction Olymel</span>
                                </div>
                                {isOlymelOpen ? <Icons.ChevronDown className="w-3.5 h-3.5" /> : <Icons.ChevronRight className="w-3.5 h-3.5" />}
                            </button>

                            <div className={`${isOlymelOpen ? 'block' : 'hidden'} p-2.5 border-t border-slate-700`}>
                                <div className="mb-3">
                                    <FileUploader id="uploader-olymel" onFileChange={onOlymelFileChange} showFileList={false} />
                                </div>


                                {/* LISTE DES FICHIERS UPLOADÉS - TRÈS VISIBLE */}
                                {olymelFiles.length > 0 && (
                                    <div className="mb-3 p-3 bg-green-900/30 border-2 border-green-500 rounded-lg">
                                        <h4 className="text-green-200 font-bold text-sm mb-1.5">
                                            📁 Fichiers Olymel uploadés ({olymelFiles.length})
                                        </h4>
                                        <ul className="space-y-0.5">
                                            {olymelFiles.map((file, index) => (
                                                <li key={index} className="text-green-100 text-xs flex items-center gap-1.5">
                                                    <span className="text-green-400">✓</span>
                                                    <span className="font-mono truncate">{file.name}</span>
                                                    <span className="text-green-400 text-[10px]">
                                                        ({(file.size / 1024).toFixed(1)} KB)
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {olymelFiles.length > 0 && (
                                    <Button
                                        onClick={onOlymelExtractData}
                                        disabled={olymelGlobalStatus === Status.Processing}
                                        className="w-full bg-cyan-600 hover:bg-cyan-700 shadow-md transform hover:scale-[1.02] transition-all"
                                    >
                                        {olymelGlobalStatus === Status.Processing ? (
                                            <>
                                                <Icons.Loader className="animate-spin mr-2" />
                                                Traitement Olymel...
                                            </>
                                        ) : (
                                            <>
                                                <Icons.Sparkles className="mr-2" />
                                                Lancer Olymel ({olymelFiles.length} fichier{olymelFiles.length > 1 ? 's' : ''})
                                            </>
                                        )}
                                    </Button>
                                )}

                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-6 mt-4">
                        {/* Icons only when sidebar collapsed */}
                        <div title="TCT" className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-emerald-400">
                            <Icons.FileText className="w-6 h-6" />
                        </div>
                        <div title="Olymel" className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-cyan-400">
                            <Icons.Truck className="w-6 h-6" />
                        </div>
                    </div>
                )}

                {/* User Section at Bottom */}
                <div className="mt-auto pt-6 border-t border-slate-700">
                    {isSidebarOpen ? (
                        <div className="bg-slate-700/50 rounded-lg p-3">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-sm">
                                    {user?.numDome.substring(0, 2)}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-slate-200 truncate">Dôme: {user?.numDome}</p>
                                    <p className="text-xs text-slate-400 truncate">ID: {user?.idEmploye} <span className="opacity-50">| v1.3</span></p>
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
                className="absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-700 hover:bg-emerald-600 text-slate-200 rounded-full p-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors z-10 shadow-md border border-slate-600"
                aria-label={isSidebarOpen ? "Réduire la barre latérale" : "Agrandir la barre latérale"}
            >
                {isSidebarOpen ? <Icons.ChevronLeft className="w-5 h-5" /> : <Icons.ChevronRight className="w-5 h-5" />}
            </button>
        </aside>
    );
};