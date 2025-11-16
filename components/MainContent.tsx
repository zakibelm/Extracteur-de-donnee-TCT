

import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { gsap } from 'gsap';
import { ResultCard } from './ResultCard';
import { Button } from './Button';
import { Icons } from './Icons';
import { ExtractedData, Status, TableData } from '../types';
import { FinalDocumentView } from './FinalDocumentView';

interface MainContentProps {
    activeView: 'extract' | 'results';
    setActiveView: (view: 'extract' | 'results') => void;
    extractedData: ExtractedData[];
    unifiedTableIsReady: boolean;
    onGenerateResults: () => void;
    error: string | null;
    unifiedTable: TableData | null;
    onPrint: (headers: string[], rows: string[][]) => void;
    onDownloadPdf: (headers: string[], rows: string[][]) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
    activeView,
    setActiveView,
    extractedData,
    unifiedTableIsReady,
    onGenerateResults,
    error,
    unifiedTable,
    onPrint,
    onDownloadPdf
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const extractionViewRef = useRef<HTMLDivElement>(null);
    const resultsViewRef = useRef<HTMLDivElement>(null);
    const isFirstLoad = useRef(true);

    useLayoutEffect(() => {
        if (extractedData.length > 0 && activeView === 'extract') {
            const ctx = gsap.context(() => {
                gsap.set(".result-card", { autoAlpha: 0, scale: 0.8, rotationZ: -5 });
                
                const tl = gsap.timeline();
                tl.from(".main-content-anim", {
                    opacity: 0,
                    y: 20,
                    duration: 0.4,
                    stagger: 0.1,
                    ease: 'power2.out'
                }).to(".result-card", {
                    autoAlpha: 1,
                    scale: 1,
                    rotationZ: 0,
                    y: 0,
                    duration: 0.5,
                    stagger: 0.07,
                    ease: 'back.out(1.7)'
                }, "-=0.2");
            }, contentRef);
            return () => ctx.revert();
        }
    }, [extractedData]);
    
    useEffect(() => {
        if (isFirstLoad.current) {
            gsap.set(resultsViewRef.current, { autoAlpha: 0, display: 'none' });
            isFirstLoad.current = false;
            return;
        }

        const fromView = activeView === 'results' ? extractionViewRef.current : resultsViewRef.current;
        const toView = activeView === 'results' ? resultsViewRef.current : extractionViewRef.current;
        
        if (fromView && toView) {
            gsap.timeline()
                .to(fromView, {
                    autoAlpha: 0,
                    x: -30,
                    duration: 0.3,
                    ease: 'power2.in',
                    onComplete: () => gsap.set(fromView, { display: 'none' })
                })
                .set(toView, { display: 'flex', autoAlpha: 0, x: 30 })
                .to(toView, {
                    autoAlpha: 1,
                    x: 0,
                    duration: 0.4,
                    ease: 'power2.out'
                });
        }
    }, [activeView]);

    const allProcessed = extractedData.length > 0 && extractedData.every(d => d.status === Status.Success || d.status === Status.Error);
    const hasSuccessfulExtractions = extractedData.some(d => d.status === Status.Success && d.content && d.content.rows.length > 0);

    const renderExtractionView = () => (
        <div ref={extractionViewRef} className="overflow-y-auto h-full flex-col flex-grow">
            {extractedData.length === 0 ? (
                <div className="text-center h-full flex flex-col justify-center items-center">
                     <Icons.UploadCloud className="w-16 h-16 text-[--color-muted-foreground] mb-4" />
                    <h2 className="text-2xl font-bold text-[--color-muted-foreground]">Commencez par téléverser des fichiers</h2>
                    <p className="text-[--color-muted-foreground] mt-2">Utilisez le panneau de gauche pour ajouter des images ou des PDFs.</p>
                </div>
            ) : (
                <div className="h-full">
                    {allProcessed && hasSuccessfulExtractions && !unifiedTableIsReady && (
                        <div className="bg-[--color-card] rounded-lg p-6 mb-8 border border-[--color-border] flex items-center justify-between main-content-anim">
                            <p className="text-[--color-card-foreground]">L'extraction est terminée. Prêt à voir les résultats consolidés ?</p>
                            <Button
                                onClick={onGenerateResults}
                                className="bg-[--color-secondary] text-[--color-secondary-foreground] hover:brightness-90"
                            >
                                <Icons.Eye className="mr-2" />
                                Générer le Document Final
                            </Button>
                        </div>
                    )}

                    {error && <p className="text-[--color-destructive] my-4 text-center p-4 bg-[--color-muted] border border-[--color-destructive] rounded-md main-content-anim">{error}</p>}

                    <h2 className="text-2xl font-bold text-center mb-8 text-[--color-foreground] main-content-anim">Extraction par Fichier</h2>
                    <div className="perspective grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {extractedData.map((data) => (
                            <ResultCard key={data.id} data={data} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <main ref={contentRef} className="flex-grow p-4 md:p-8 overflow-hidden flex flex-col bg-transparent">
             <div className="max-w-7xl mx-auto w-full flex flex-col flex-grow min-h-0">
                <div className="border-b border-[--color-border] mb-4">
                    <nav className="flex space-x-4" aria-label="Tabs">
                        <button
                            onClick={() => setActiveView('extract')}
                            className={`px-3 py-2 font-medium text-sm rounded-t-md ${activeView === 'extract' ? 'border-b-2 border-[--color-primary] text-[--color-primary]' : 'text-[--color-muted-foreground] hover:text-[--color-foreground]'}`}
                        >
                            <Icons.ScanText className="inline-block mr-2 w-5 h-5" />
                            Extraction
                        </button>
                         {unifiedTableIsReady && (
                            <button
                                onClick={() => setActiveView('results')}
                                className={`px-3 py-2 font-medium text-sm rounded-t-md ${activeView === 'results' ? 'border-b-2 border-[--color-primary] text-[--color-primary]' : 'text-[--color-muted-foreground] hover:text-[--color-foreground]'}`}
                            >
                                <Icons.Eye className="inline-block mr-2 w-5 h-5" />
                                Résultats
                            </button>
                        )}
                    </nav>
                </div>

                <div className="flex-grow flex flex-col min-h-0 relative">
                    {renderExtractionView()}
                    {unifiedTable && (
                        <div ref={resultsViewRef} className="flex-col flex-grow min-h-0 absolute inset-0">
                           <FinalDocumentView 
                                tableData={unifiedTable}
                                onPrint={onPrint}
                                onDownloadPdf={onDownloadPdf}
                            />
                        </div>
                    )}
                </div>
                
                {activeView === 'extract' && (
                    <footer className="text-center p-4 mt-8 text-[--color-muted-foreground] text-sm">
                        <p>Propulsé par Zakibelm</p>
                    </footer>
                )}
            </div>
        </main>
    );
};