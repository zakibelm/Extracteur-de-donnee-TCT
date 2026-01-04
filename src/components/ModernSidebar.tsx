import React, { useState } from 'react';
import { Icons } from './Icons';
import { User, Status } from '../types';
import { FileUploader } from './FileUploader';
import { Button } from './ui/Button';
import { useTheme } from '../theme/ThemeContext';

interface ModernSidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;

    // TCT
    tctFiles: File[];
    onTctFileChange: (files: File[]) => void;
    onTctExtractData: () => void;
    tctGlobalStatus: Status;
    isTctOpen: boolean;
    setIsTctOpen: (open: boolean) => void;

    // Olymel
    olymelFiles: File[];
    onOlymelFileChange: (files: File[]) => void;
    onOlymelExtractData: () => void;
    olymelGlobalStatus: Status;
    isOlymelOpen: boolean;
    setIsOlymelOpen: (open: boolean) => void;

    // Common
    user: User;
    onLogout: () => void;
    onSectionChange: (section: 'tct' | 'olymel' | 'settings') => void;
    activeSection: 'tct' | 'olymel' | 'settings';
}

export const ModernSidebar: React.FC<ModernSidebarProps> = ({
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
    user,
    onLogout,
    onSectionChange,
    activeSection
}) => {
    const { theme, toggleTheme } = useTheme();

    const SectionHeader: React.FC<{
        title: string;
        icon: React.ReactNode;
        isOpen: boolean;
        toggle: () => void;
        color: string;
    }> = ({ title, icon, isOpen, toggle, color }) => (
        <button
            onClick={toggle}
            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 group ${
                isOpen ? `bg-gradient-to-r ${color} shadow-lg` : 'bg-slate-800/50 dark:bg-slate-800/50 hover:bg-slate-700/50'
            }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${isOpen ? 'bg-white/20' : 'bg-slate-700'} flex items-center justify-center transition-all`}>
                    {icon}
                </div>
                <span className={`font-semibold text-lg ${isOpen ? 'text-white' : 'text-slate-300'}`}>
                    {title}
                </span>
            </div>
            <Icons.ChevronRight className={`w-5 h-5 transition-transform duration-200 ${
                isOpen ? 'rotate-90 text-white' : 'text-slate-400 group-hover:text-slate-300'
            }`} />
        </button>
    );

    return (
        <>
            {/* Overlay for mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`fixed lg:relative z-50 h-screen bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-700/50 flex flex-col transition-all duration-300 ease-in-out ${
                    isSidebarOpen ? 'translate-x-0 w-80' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0'
                }`}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-700/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
                                <Icons.Truck className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">ADT Extracteur</h1>
                                <p className="text-xs text-slate-400">Données Tabulaires</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="lg:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <Icons.X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>

                    {/* User Info */}
                    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                    {user.idEmploye.substring(0, 2).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{user.idEmploye}</p>
                                <p className="text-xs text-slate-400 truncate">Domaine: {user.numDome}</p>
                            </div>
                            {user.isAdmin && (
                                <span className="px-2 py-1 text-xs font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                                    ADMIN
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {/* TCT Section */}
                    <div className="space-y-2">
                        <SectionHeader
                            title="TCT Transport"
                            icon={<Icons.FileText className="w-5 h-5" />}
                            isOpen={isTctOpen}
                            toggle={() => {
                                setIsTctOpen(!isTctOpen);
                                if (!isTctOpen) onSectionChange('tct');
                            }}
                            color="from-sky-600 to-cyan-600"
                        />
                        {isTctOpen && (
                            <div className="pl-4 pr-2 py-3 space-y-3 animate-slideDown">
                                <FileUploader
                                    onFileChange={onTctFileChange}
                                    acceptedFormats=".pdf,.png,.jpg,.jpeg"
                                    multiple={true}
                                />
                                {tctFiles.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-400 font-medium">
                                            {tctFiles.length} fichier(s) sélectionné(s)
                                        </p>
                                        <Button
                                            onClick={onTctExtractData}
                                            variant="primary"
                                            size="md"
                                            fullWidth
                                            loading={tctGlobalStatus === Status.Processing || tctGlobalStatus === Status.AiProcessing}
                                            disabled={tctGlobalStatus === Status.Processing || tctGlobalStatus === Status.AiProcessing}
                                            icon={<Icons.Sparkles className="w-4 h-4" />}
                                        >
                                            {tctGlobalStatus === Status.AiProcessing ? 'Analyse IA...' : 'Extraire TCT'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Olymel Section */}
                    <div className="space-y-2">
                        <SectionHeader
                            title="Olymel Transport"
                            icon={<Icons.Calendar className="w-5 h-5" />}
                            isOpen={isOlymelOpen}
                            toggle={() => {
                                setIsOlymelOpen(!isOlymelOpen);
                                if (!isOlymelOpen) onSectionChange('olymel');
                            }}
                            color="from-emerald-600 to-teal-600"
                        />
                        {isOlymelOpen && (
                            <div className="pl-4 pr-2 py-3 space-y-3 animate-slideDown">
                                <FileUploader
                                    onFileChange={onOlymelFileChange}
                                    acceptedFormats=".pdf,.png,.jpg,.jpeg"
                                    multiple={true}
                                />
                                {olymelFiles.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-400 font-medium">
                                            {olymelFiles.length} fichier(s) sélectionné(s)
                                        </p>
                                        <Button
                                            onClick={onOlymelExtractData}
                                            variant="secondary"
                                            size="md"
                                            fullWidth
                                            loading={olymelGlobalStatus === Status.Processing || olymelGlobalStatus === Status.AiProcessing}
                                            disabled={olymelGlobalStatus === Status.Processing || olymelGlobalStatus === Status.AiProcessing}
                                            icon={<Icons.Sparkles className="w-4 h-4" />}
                                        >
                                            {olymelGlobalStatus === Status.AiProcessing ? 'Analyse IA...' : 'Extraire Olymel'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-700/50 space-y-2">
                    <button
                        onClick={() => onSectionChange('settings')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                            activeSection === 'settings'
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                        }`}
                    >
                        <Icons.Settings className="w-5 h-5" />
                        <span className="font-medium">Paramètres</span>
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 transition-all duration-200"
                    >
                        {theme === 'dark' ? <Icons.Sun className="w-5 h-5" /> : <Icons.Moon className="w-5 h-5" />}
                        <span className="font-medium">{theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}</span>
                    </button>

                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-600/20 transition-all duration-200"
                    >
                        <Icons.LogOut className="w-5 h-5" />
                        <span className="font-medium">Déconnexion</span>
                    </button>
                </div>
            </div>

            {/* Custom scrollbar styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(148, 163, 184, 0.3);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(148, 163, 184, 0.5);
                }
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-slideDown {
                    animation: slideDown 0.3s ease-out;
                }
            `}</style>
        </>
    );
};
