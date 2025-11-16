
import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { FileUploader } from './FileUploader';
import { Button } from './Button';
import { Icons } from './Icons';
import { Status } from '../types';

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    files: File[];
    onFileChange: (files: File[]) => void;
    onExtractData: () => void;
    globalStatus: Status;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    setIsSidebarOpen,
    files,
    onFileChange,
    onExtractData,
    globalStatus
}) => {
    const sidebarRef = useRef<HTMLElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const chevronRef = useRef<SVGSVGElement>(null);
    const tl = useRef<gsap.core.Timeline>();

    useLayoutEffect(() => {
        gsap.set(contentRef.current, { autoAlpha: isSidebarOpen ? 1 : 0 });
        gsap.set(chevronRef.current, { rotation: isSidebarOpen ? 0 : 180 });
    }, [isSidebarOpen]);

    useLayoutEffect(() => {
        const sidebar = sidebarRef.current;
        const content = contentRef.current;
        const chevron = chevronRef.current;
        
        tl.current = gsap.timeline({ paused: true })
            .to(content, { autoAlpha: 0, duration: 0.2 }, 0)
            .to(sidebar, { width: 80, duration: 0.4, ease: 'power3.inOut' }, 0)
            .to(chevron, { rotation: 180, duration: 0.4, ease: 'power3.inOut' }, 0);

        return () => {
            tl.current?.kill();
        };
    }, []);

    const toggleSidebar = () => {
        if (tl.current) {
            isSidebarOpen ? tl.current.play() : tl.current.reverse();
            setIsSidebarOpen(!isSidebarOpen);
        }
    };


    return (
        <aside ref={sidebarRef} className={`relative bg-[--color-sidebar] border-r border-[--color-sidebar-border] flex flex-col backdrop-blur-sm w-96`}>
            <div className="flex-grow p-4 overflow-y-auto">
                <header className={`flex items-center gap-4 mb-8 ${!isSidebarOpen ? 'justify-center' : ''}`}>
                    <div className="w-12 h-12 bg-[--color-sidebar-primary] rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-2xl font-bold text-[--color-sidebar-primary-foreground]">EDT</span>
                    </div>
                    <div ref={contentRef}>
                        <div>
                            <h1 className="text-xl font-extrabold text-[--color-sidebar-primary]">
                                EDT
                            </h1>
                            <p className="text-sm text-[--color-muted-foreground]">Extracteur de Données</p>
                        </div>
                    </div>
                </header>
                
                <div ref={contentRef}>
                    <div className="sidebar-anim-item">
                        <FileUploader onFileChange={onFileChange} />
                    </div>
                    {files.length > 0 && (
                        <div className="mt-8 sidebar-anim-item">
                            <Button
                                onClick={onExtractData}
                                disabled={globalStatus === Status.Processing}
                                className="w-full text-[--color-primary-foreground] hover:brightness-110 btn-primary-gradient"
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
                </div>
            </div>

            <button
                onClick={toggleSidebar}
                className="absolute -right-3 top-1/2 -translate-y-1/2 bg-[--color-muted] hover:bg-[--color-primary] text-[--color-foreground] rounded-full p-1.5 focus:outline-none focus:ring-2 focus:ring-[--color-ring] transition-colors"
                aria-label={isSidebarOpen ? "Réduire la barre latérale" : "Agrandir la barre latérale"}
            >
                <Icons.ChevronLeft ref={chevronRef} className="w-5 h-5" />
            </button>
        </aside>
    );
};