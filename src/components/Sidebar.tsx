import React, { useRef } from 'react';
import { FileUploader } from './FileUploader';
import { Button } from './Button';
import { Icons } from './Icons';
import { Status, User } from '../types'; // Import from centralized types
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export type AppSection = 'tct' | 'olymel' | 'settings';

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;

    // TCT Props (Remote Architecture)
    tctFiles: File[];
    onTctFileChange: (files: File[]) => void;
    onTctExtractData: () => void;
    tctGlobalStatus: Status;
    isTctOpen: boolean;
    setIsTctOpen: (isOpen: boolean) => void;

    // Olymel Props (Remote Architecture)
    olymelFiles: File[];
    onOlymelFileChange: (files: File[]) => void;
    onOlymelExtractData: () => void;
    olymelGlobalStatus: Status;
    isOlymelOpen: boolean;
    setIsOlymelOpen: (isOpen: boolean) => void;
    olymelChangeEventCount: number;

    // User & Nav Props
    user?: User;
    onLogout?: () => void;
    onSectionChange: (section: 'tct' | 'olymel' | 'settings') => void;
    activeSection: 'tct' | 'olymel' | 'settings';
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
    user,
    onLogout,
    onSectionChange,
    activeSection
}) => {
    const sidebarRef = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        if (isSidebarOpen) {
            gsap.from(".nav-item", {
                x: -20,
                opacity: 0,
                duration: 0.4,
                stagger: 0.05,
                ease: "power2.out"
            });
        }
    }, [isSidebarOpen]);

    // Reusable Nav Item Component adapted for Accordion Logic
    const AccordionItem = ({
        sectionId,
        isOpen,
        setIsOpen,
        icon: Icon,
        label,
        colorClass,
        children
    }: {
        sectionId: AppSection,
        isOpen: boolean,
        setIsOpen: (v: boolean) => void,
        icon: any,
        label: string,
        colorClass: string,
        children?: React.ReactNode
    }) => {
        const isActive = activeSection === sectionId;

        return (
            <div className={`nav-item mb-3 transition-all duration-300 ${isOpen ? 'bg-white/5 rounded-2xl border border-white/5 shadow-lg backdrop-blur-sm' : ''}`}>
                <button
                    onClick={() => {
                        setIsOpen(!isOpen);
                        if (!isOpen) onSectionChange(sectionId);
                    }}
                    className={`w-full flex items-center p-3.5 rounded-2xl transition-all duration-300 group ${isActive || isOpen
                        ? `${colorClass} text-white shadow-lg relative z-10 ring-1 ring-white/20`
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 hover:shadow-md'
                        }`}
                    title={!isSidebarOpen ? label : undefined}
                >
                    <div className={`relative flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300 ${isActive || isOpen ? 'bg-white/20' : 'bg-slate-800/50 group-hover:bg-slate-700/50'}`}>
                        <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${isActive || isOpen ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    </div>

                    {isSidebarOpen && (
                        <span className="ml-3 font-medium whitespace-nowrap text-sm tracking-wide">{label}</span>
                    )}

                    {isSidebarOpen && (
                        <div className="ml-auto">
                            {isOpen ? <Icons.ChevronDown className="w-4 h-4 opacity-70" /> : <Icons.ChevronRight className="w-4 h-4 opacity-70" />}
                        </div>
                    )}
                </button>

                {/* Accordion Content */}
                {isSidebarOpen && isOpen && children && (
                    <div className="p-3 animate-fadeIn">
                        <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5 backdrop-blur-md">
                            {children}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside
            ref={sidebarRef}
            className={`relative h-full bg-slate-900/60 backdrop-blur-2xl border-r border-white/5 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isSidebarOpen ? 'w-80' : 'w-24'} shadow-2xl z-50`}
        >
            <div className="flex-grow flex flex-col p-4 overflow-y-auto custom-scrollbar min-h-0">
                {/* Header */}
                <header className={`flex items-center gap-4 mb-8 mt-2 flex-shrink-0 ${isSidebarOpen ? 'justify-start pl-2' : 'justify-center'}`}>
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0 ring-1 ring-white/10 relative overflow-hidden group cursor-pointer hover:shadow-emerald-500/40 transition-shadow">
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <span className="text-xl font-bold text-white relative z-10">ADT</span>
                    </div>
                    {isSidebarOpen && (
                        <div className="flex-col animate-fadeIn">
                            <h1 className="text-xl font-bold text-white leading-none tracking-tight">ADT</h1>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">Taxi Coop Terrebonne</p>
                        </div>
                    )}
                </header>

                {/* Navigation */}
                <nav className="flex-grow space-y-1">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4 pl-4 truncate">
                        {isSidebarOpen ? 'Extraction' : '...'}
                    </div>

                    {/* TCT Section */}
                    <AccordionItem
                        sectionId="tct"
                        isOpen={isTctOpen}
                        setIsOpen={setIsTctOpen}
                        icon={Icons.FileText}
                        label="Extraction TCT"
                        colorClass="bg-gradient-to-r from-emerald-600 to-emerald-500"
                    >
                        <FileUploader onFileChange={onTctFileChange} />
                        {tctFiles.length > 0 && (
                            <div className="mt-3">
                                <div className="text-xs text-emerald-300 mb-2 flex items-center">
                                    <Icons.CheckCircle className="w-3 h-3 mr-1" />
                                    {tctFiles.length} fichier(s) prêt(s)
                                </div>
                                <Button
                                    onClick={onTctExtractData}
                                    disabled={tctGlobalStatus === Status.Processing}
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 py-2 text-xs font-bold"
                                >
                                    {tctGlobalStatus === Status.Processing ? (
                                        <><Icons.Loader className="animate-spin mr-2 w-3 h-3" /> Traitement...</>
                                    ) : (
                                        <><Icons.Sparkles className="mr-2 w-3 h-3" /> Lancer TCT ({tctFiles.length})</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </AccordionItem>

                    {/* Olymel Section */}
                    <AccordionItem
                        sectionId="olymel"
                        isOpen={isOlymelOpen}
                        setIsOpen={setIsOlymelOpen}
                        icon={Icons.Truck}
                        label="Extraction Olymel"
                        colorClass="bg-gradient-to-r from-cyan-600 to-cyan-500"
                    >
                        <FileUploader onFileChange={onOlymelFileChange} />
                        {olymelFiles.length > 0 && (
                            <div className="mt-3">
                                <div className="text-xs text-cyan-300 mb-2 flex items-center">
                                    <Icons.CheckCircle className="w-3 h-3 mr-1" />
                                    {olymelFiles.length} fichier(s) prêt(s)
                                </div>
                                <Button
                                    onClick={onOlymelExtractData}
                                    disabled={olymelGlobalStatus === Status.Processing}
                                    className="w-full bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20 py-2 text-xs font-bold"
                                >
                                    {olymelGlobalStatus === Status.Processing ? (
                                        <><Icons.Loader className="animate-spin mr-2 w-3 h-3" /> Traitement...</>
                                    ) : (
                                        <><Icons.Sparkles className="mr-2 w-3 h-3" /> Lancer Olymel ({olymelFiles.length})</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </AccordionItem>

                    <div className="pt-6 mt-6 border-t border-white/5">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4 pl-4 truncate">
                            {isSidebarOpen ? 'Système' : '...'}
                        </div>

                        <div className={`nav-item mb-3 transition-all duration-300`}>
                            <button
                                onClick={() => onSectionChange('settings')}
                                className={`w-full flex items-center p-3.5 rounded-2xl transition-all duration-300 group ${activeSection === 'settings'
                                    ? `bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg relative z-10 ring-1 ring-white/20`
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 hover:shadow-md'
                                    }`}
                                title={!isSidebarOpen ? "Paramètres" : undefined}
                            >
                                <div className={`relative flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300 ${activeSection === 'settings' ? 'bg-white/20' : 'bg-slate-800/50 group-hover:bg-slate-700/50'}`}>
                                    <Icons.Settings className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeSection === 'settings' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                                </div>

                                {isSidebarOpen && (
                                    <span className="ml-3 font-medium whitespace-nowrap text-sm tracking-wide">Paramètres</span>
                                )}
                            </button>
                        </div>
                    </div>
                </nav>

                {/* User Section */}
                <div className="mt-auto pt-6 border-t border-white/5 flex-shrink-0">
                    {isSidebarOpen ? (
                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm group hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ring-2 ring-emerald-500/50 shadow-lg">
                                    {(user?.numDome || "??").substring(0, 2)}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">Dôme: {user?.numDome}</p>
                                    <p className="text-xs text-slate-400 truncate font-medium">ID: {user?.idEmploye}</p>
                                </div>
                            </div>
                            <button
                                onClick={onLogout}
                                className="w-full flex items-center justify-start px-3 py-2 text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/80 rounded-xl transition-all duration-200"
                            >
                                <Icons.LogOut className="w-3.5 h-3.5 mr-2" />
                                DÉCONNEXION
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onLogout}
                            className="w-full flex justify-center p-3 text-red-400 hover:text-white hover:bg-red-500/80 rounded-xl transition-all duration-200 shadow-sm"
                            title="Se déconnecter"
                        >
                            <Icons.LogOut className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Toggle Button */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-800/80 hover:bg-emerald-500 text-slate-300 hover:text-white rounded-full p-1.5 shadow-lg border border-white/10 focus:outline-none backdrop-blur-sm transition-all duration-200 z-50 group hover:scale-110"
            >
                {isSidebarOpen ? <Icons.ChevronLeft className="w-4 h-4" /> : <Icons.ChevronRight className="w-4 h-4" />}
            </button>
        </aside>
    );
};
