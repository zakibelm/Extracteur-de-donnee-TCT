import { saveExtractionToSupabase, getSavedExtraction } from './services/supabaseService';
import { prepareImage } from './utils/prepareImage';
import { setExtractionKey } from './services/extractionSettings';

/**
 * <summary>
 * Architecture refactorisée avec séparation complète TCT et Olymel
 * Chaque section a ses propres états, handlers et localStorage
 * </summary>
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { ExtractedData, Status, TableData, User } from './types';
import { mapConcurrent } from './utils/concurrency';
import { buildUnifiedTable, validateTable, TCT_HEADERS, toTctRecords } from './utils/table';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractDocumentViaN8n } from './services/n8n';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AuthPage } from './components/AuthPage';

// Set worker path for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface ProcessableFile {
    id: string;
    file: File;
    originalFileName: string;
    base64: string;
    mimeType: string;
}

/**
 * Processes a single page of a PDF document into an image File object.
 */
async function processPage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, originalPdfName: string, retryCount = 0): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'> | null> {
    try {
        console.log(`📄 Traitement de la page ${pageNum}/${pdf.numPages} de ${originalPdfName}`);
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
            await page.render({ canvasContext: context, viewport: viewport } as any).promise;
            const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
            if (blob) {
                const pageFileName = `${originalPdfName}-page-${pageNum}.jpg`;
                const pageFile = new File([blob], pageFileName, { type: 'image/jpeg' });
                console.log(`✅ Page ${pageNum} convertie avec succès (${(blob.size / 1024).toFixed(2)} KB)`);
                return { file: pageFile, originalFileName: originalPdfName, id: `${pageFileName}-${Date.now()}` };
            } else {
                console.error(`❌ Échec de conversion en blob pour la page ${pageNum}`);
            }
        } else {
            console.error(`❌ Impossible d'obtenir le contexte 2D pour la page ${pageNum}`);
        }

        // Retry logic
        if (retryCount < 2) {
            console.warn(`🔄 Nouvelle tentative pour la page ${pageNum} (tentative ${retryCount + 1}/2)`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            return processPage(pdf, pageNum, originalPdfName, retryCount + 1);
        }

        return null;
    } catch (error) {
        console.error(`❌ Erreur lors du traitement de la page ${pageNum}:`, error);

        // Retry logic
        if (retryCount < 2) {
            console.warn(`🔄 Nouvelle tentative pour la page ${pageNum} après erreur (tentative ${retryCount + 1}/2)`);
            await new Promise(resolve => setTimeout(resolve, 500));
            return processPage(pdf, pageNum, originalPdfName, retryCount + 1);
        }

        return null;
    }
}

const processPdf = async (pdfFile: File): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'>[]> => {
    console.time(`PDF_Convert_${pdfFile.name}`);
    console.log(`📚 Début du traitement du PDF: ${pdfFile.name}`);

    const fileBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(fileBuffer).promise;

    console.log(`📖 PDF chargé: ${pdf.numPages} pages détectées`);

    if (pdf.numPages > 50) throw new Error('Maximum 50 pages par PDF. Séparez le document.');
    const pageResults = await mapConcurrent(Array.from({ length: pdf.numPages }, (_, i) => i + 1),
        2, page => processPage(pdf, page, pdfFile.name));

    const successfulPages = pageResults.filter((result): result is Omit<ProcessableFile, 'base64' | 'mimeType'> => result !== null);
    const failedCount = pdf.numPages - successfulPages.length;

    if (failedCount > 0) {
        throw new Error(`${failedCount} page(s) PDF non converties. Réessayez avec un document plus petit.`);
    }

    console.log(`✅ ${successfulPages.length}/${pdf.numPages} pages converties avec succès`);
    console.timeEnd(`PDF_Convert_${pdfFile.name}`);

    return successfulPages;
};

    class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
        constructor(props: { children: React.ReactNode }) {
            super(props);
            this.state = { hasError: false, error: null };
        }

        static getDerivedStateFromError(error: Error) {
            return { hasError: true, error };
        }

        componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
            console.error("Uncaught Error:", error, errorInfo);
        }

        render() {
            if (this.state.hasError) {
                return (
                    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-red-500 p-8">
                        <h1 className="text-3xl font-bold mb-4">Une erreur critique est survenue</h1>
                        <div className="bg-slate-800 p-6 rounded-lg border border-red-500/50 max-w-2xl w-full">
                            <p className="text-xl text-white mb-4">Message d'erreur :</p>
                            <pre className="text-sm bg-black/50 p-4 rounded overflow-auto whitespace-pre-wrap font-mono">
                                {this.state.error?.toString()}
                            </pre>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                                Recharger l'application
                            </button>
                        </div>
                    </div>
                );
            }

            return this.props.children;
        }
    }


export const App: React.FC = () => {
    console.log('🚀 App component is rendering...');

    const saveRequestId = useRef(crypto.randomUUID());

    const tctRun = useRef(0);
    const olymelRun = useRef(0);
    // Auth State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Section active (TCT ou Olymel ou Settings)
    const [activeSection, setActiveSection] = useState<'tct' | 'olymel' | 'settings'>('tct');

    // ========== AUTH INITIALIZATION ==========
    // Écouter les changements d'authentification Supabase au démarrage
    useEffect(() => {
        let isMounted = true;
        let unsubscribe: (() => void) | undefined;

        const initializeAuth = async () => {
            try {
                // Importer le service d'authentification
                const { authService } = await import('./services/authService');

                // Récupérer l'utilisateur actuel si connecté
                const user = await authService.getCurrentUser();
                if (isMounted) {
                    setCurrentUser(user);
                    setAuthLoading(false);
                }

                // Écouter les changements d'état d'authentification
                const subscription = authService.onAuthStateChange((user) => {
                    if (isMounted) {
                        setCurrentUser(user);
                        console.log('[Auth] État changé:', user ? user.email : 'Non connecté');
                    }
                });

                if (!isMounted) subscription.unsubscribe();
                else unsubscribe = () => subscription.unsubscribe();
            } catch (error) {
                console.error('[Auth] Erreur initialisation:', error);
                if (isMounted) {
                    setAuthLoading(false);
                }
            }
        };

        initializeAuth();

        return () => {
            isMounted = false;
            unsubscribe?.();
        };
    }, []);

    useEffect(() => {
        if (!isSidebarOpen) return;
        const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsSidebarOpen(false); };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [isSidebarOpen]);

    // Accordion State (Hoisted from Sidebar for persistence)
    const [isTctOpen, setIsTctOpen] = useState(true);
    const [isOlymelOpen, setIsOlymelOpen] = useState(false);

    // DEBUG: Event counters to track handler calls
    const [olymelChangeEventCount, setOlymelChangeEventCount] = useState(0);

    // ========== ÉTATS TCT ==========
    const [tctFiles, setTctFiles] = useState<File[]>([]);
    const [tctExtractedData, setTctExtractedData] = useState<ExtractedData[]>([]);
    const [tctGlobalStatus, setTctGlobalStatus] = useState<Status>(Status.Idle);
    const [tctError, setTctError] = useState<string | null>(null);
    const [tctUnifiedTable, setTctUnifiedTable] = useState<TableData | null>(null);
    const [activeTctView, setActiveTctView] = useState<'extract' | 'document' | 'report'>('extract');
    const [tctSaveStatus, setTctSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'dirty' | 'error'>('idle');
    const [tctSaveMessage, setTctSaveMessage] = useState('');
    const [historyRefresh, setHistoryRefresh] = useState(0);
    const [tctDocumentName, setTctDocumentName] = useState('');

    // ========== ÉTATS OLYMEL ==========
    const [olymelFiles, setOlymelFiles] = useState<File[]>([]);
    const [olymelExtractedData, setOlymelExtractedData] = useState<ExtractedData[]>([]);
    const [olymelGlobalStatus, setOlymelGlobalStatus] = useState<Status>(Status.Idle);
    const [olymelError, setOlymelError] = useState<string | null>(null);
    const [olymelUnifiedTable, setOlymelUnifiedTable] = useState<TableData | null>(null);
    const [activeOlymelView, setActiveOlymelView] = useState<'extract' | 'calendar' | 'report'>('extract');

    useEffect(() => {
        tctRun.current++;
        olymelRun.current++;
        localStorage.removeItem('edt_tct_unified_table');
        localStorage.removeItem('edt_olymel_unified_table');
        localStorage.removeItem('edt_user');
        localStorage.removeItem('adt_settings_apikey');
        setExtractionKey('');
        setTctUnifiedTable(null);
        setTctSaveStatus('idle');
        setTctSaveMessage('');
        setOlymelUnifiedTable(null);
        setTctExtractedData([]);
        setOlymelExtractedData([]);
        setTctFiles([]);
        setOlymelFiles([]);
        saveRequestId.current = crypto.randomUUID();
    }, [currentUser?.id]);

    useEffect(() => {
        if (!['dirty', 'error', 'saving'].includes(tctSaveStatus)) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [tctSaveStatus]);

    // Effet pour basculer les non-admins vers la vue document
    useEffect(() => {
        if (currentUser && !currentUser.isAdmin) {
            if (activeSection === 'tct') {
                setActiveTctView('document');
            } else {
                setActiveOlymelView('calendar');
            }
        }
    }, [currentUser, activeSection]);

    // ========== HANDLERS AUTH ==========
    const handleLogin = (user: User) => {
        setCurrentUser(user);
    };

    const handleLogout = async () => {
        try {
            const { authService } = await import('./services/authService');
            await authService.logout();
            setCurrentUser(null);
            console.log('[Auth] Déconnexion réussie');
        } catch (error) {
            console.error('[Auth] Erreur déconnexion:', error);
        }
    };

    // ========== HANDLERS TCT ==========
    const handleTctFileChange = (selectedFiles: File[]) => {
        if (tctSaveStatus === 'saving') { setTctError('Attendez la fin de l’enregistrement avant de changer de document.'); return; }
        if (['dirty', 'error'].includes(tctSaveStatus) && !window.confirm('Le tableau actuel n’est pas enregistré. Abandonner ces modifications et importer un autre document ?')) return;
        tctRun.current++;
        saveRequestId.current = crypto.randomUUID();
        setTctFiles(selectedFiles);
        setTctDocumentName(selectedFiles.map(file => file.name).join(', ').slice(0, 255));
        setTctExtractedData([]);
        setTctError(null);
        setTctUnifiedTable(null);
        setTctSaveStatus('idle');
        setTctSaveMessage('');
        setTctGlobalStatus(Status.Idle);
        setActiveTctView('extract');
        setActiveSection('tct');
        localStorage.removeItem('edt_tct_unified_table');
    };

    const handleTctExtractData = async () => {
        if (!currentUser?.isAdmin || tctFiles.length === 0 || tctSaveStatus === 'saving') return;
        if (['dirty', 'error'].includes(tctSaveStatus) && !window.confirm('Relancer l’analyse abandonnera le tableau non enregistré. Continuer ?')) return;

        saveRequestId.current = crypto.randomUUID();
        const run = ++tctRun.current;
        setActiveSection('tct');
        setActiveTctView('extract');
        setIsSidebarOpen(false);
        setTctGlobalStatus(Status.Processing);
        setTctExtractedData([]);
        setTctError(null);
        setTctUnifiedTable(null);
        setTctSaveStatus('idle');
        setTctSaveMessage('');
        localStorage.removeItem('edt_tct_unified_table');

        let processableFiles: ProcessableFile[] = [];

        try {
            for (const file of tctFiles) {
                if (file.type === 'application/pdf') {
                    const pageImages = await processPdf(file);
                    for (const page of pageImages) {
                        const prepared = await prepareImage(page.file);
                        processableFiles.push({ ...page, ...prepared });
                    }
                } else {
                    const prepared = await prepareImage(file);
                    processableFiles.push({
                        id: `${file.name}-${Date.now()}`,
                        file,
                        originalFileName: file.name,
                        ...prepared
                    });
                }
            }
        } catch (e) {
            console.error("Erreur pré-traitement TCT", e);
            if (run !== tctRun.current) return;
            setTctError(e instanceof Error ? e.message : "Erreur lors de la préparation des fichiers.");
            setTctGlobalStatus(Status.Error);
            return;
        }

        if (run !== tctRun.current) return;
        setTctGlobalStatus(Status.AiProcessing);

        const initialDataState = processableFiles.map(f => ({
            id: f.id,
            fileName: f.originalFileName.includes(f.file.name) ? f.file.name : f.originalFileName + " (page)",
            imageSrc: `data:${f.mimeType};base64,${f.base64}`,
            content: null,
            status: Status.Processing
        }));
        setTctExtractedData(initialDataState);

        const completed: ExtractedData[] = [...initialDataState];
        const promises = mapConcurrent(processableFiles, 2, async (pFile, index) => {
            try {
                if (run !== tctRun.current) return { status: Status.Error };
                setTctExtractedData(prev => {
                    if (run !== tctRun.current) return prev;
                    const newArr = [...prev];
                    if (newArr[index]) newArr[index].status = Status.AiProcessing;
                    return newArr;
                });

                // APPEL AU BACKEND N8N AU LIEU DE AISERVICE
                const content = await extractDocumentViaN8n(pFile.base64, 'tct', pFile.mimeType);
                const status = content.headers[0] === 'Erreur' ? Status.Error : Status.Success;
                completed[index] = { ...initialDataState[index], content, status };

                setTctExtractedData(prev => {
                    if (run !== tctRun.current) return prev;
                    const newArr = [...prev];
                    if (newArr[index]) {
                        newArr[index].content = content;
                        newArr[index].status = status;
                    }
                    return newArr;
                });

                return { status };
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'Échec extraction';
                completed[index] = { ...initialDataState[index], content: { headers: ['Erreur'], rows: [[errorMessage]] }, status: Status.Error };
                setTctExtractedData(prev => {
                    if (run !== tctRun.current) return prev;
                    const newArr = [...prev];
                    if (newArr[index]) {
                        newArr[index].content = { headers: ['Erreur'], rows: [[e instanceof Error ? e.message : 'Échec extraction']] };
                        newArr[index].status = Status.Error;
                    }
                    return newArr;
                });
                return { status: Status.Error };
            }
        });

        await promises;
        if (run !== tctRun.current) return;
        try {
            if (completed.length && completed.every(result => result.status === Status.Success)) {
                const unified = buildUnifiedTable(completed);
                if (unified) {
                    setTctUnifiedTable(unified);
                    setActiveTctView('document');
                    if (window.matchMedia('(max-width: 1023px)').matches) setIsSidebarOpen(false);
                    await persistTctTable(unified, run);
                } else setTctError('Aucune ligne reconnue. Vérifiez la lisibilité du document.');
            } else {
                const failures = completed.filter(result => result.status === Status.Error);
                setTctError(failures.map(result => `${result.fileName} : ${result.content?.rows[0]?.[0] || 'Analyse interrompue.'}`).join(' | ') || 'Analyse interrompue. Réessayez.');
            }
        } catch (error) {
            if (run === tctRun.current) setTctError(error instanceof Error ? error.message : 'Enregistrement impossible.');
        } finally { if (run === tctRun.current) setTctGlobalStatus(Status.Idle); }
    };

    const persistTctTable = async (table: TableData, run: number) => {
        if (!currentUser) throw new Error('Session expirée. Reconnectez-vous.');
        const requestId = saveRequestId.current;
        const isCurrent = () => run === tctRun.current && saveRequestId.current === requestId;
        setTctSaveStatus('saving'); setTctSaveMessage('Enregistrement en cours… Gardez cette page ouverte.');
        try {
            const result = await saveExtractionToSupabase({
                document: { filename: tctDocumentName || 'Extraction TCT', upload_date: new Date().toISOString(),
                    status: 'success', user_id: currentUser.id, extracted_count: table.rows.length },
                tournees: toTctRecords(table), user_id: currentUser.id, request_id: requestId, metadata: table.metadata,
            });
            if (isCurrent()) {
                setTctSaveStatus('saved');
                setTctSaveMessage(`${result.tourneesCount} lignes enregistrées (contenu à vérifier) · Document nº ${result.documentId}. Vous pouvez le retrouver dans l’historique.`);
                setHistoryRefresh(value => value + 1);
            }
        } catch (error) {
            if (isCurrent()) { setTctSaveStatus('error'); setTctSaveMessage('Non enregistré : le tableau reste affiché. Cliquez sur Réessayer l’enregistrement.'); }
            throw error;
        }
    };

    const handleTctGenerateResults = async () => {
        if (tctSaveStatus === 'saving') return;
        setTctError(null);
        try {
            const table = tctUnifiedTable || buildUnifiedTable(tctExtractedData);
            if (!table) throw new Error('Aucune donnée valide à enregistrer.');
            if (!tctUnifiedTable && tctExtractedData.some(d => d.status !== Status.Success)) throw new Error('Extraction incomplète. Relancez les fichiers en erreur.');
            setTctUnifiedTable(table); setActiveTctView('document');
            if (tctSaveStatus !== 'saved') await persistTctTable(table, tctRun.current);
        } catch (error) { setTctError(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    };

    const handleTctTableUpdate = (newTable: TableData) => {
        setTctUnifiedTable(newTable);
        saveRequestId.current = crypto.randomUUID();
        setTctSaveStatus('dirty');
        setTctSaveMessage('Modifications non enregistrées. Enregistrez une nouvelle version pour les conserver.');
    };

    const handleOpenSavedDocument = async (id: number) => {
        if (!currentUser) throw new Error('Session expirée.');
        if (tctGlobalStatus === Status.Processing || tctGlobalStatus === Status.AiProcessing) throw new Error('Attendez la fin de l’analyse avant d’ouvrir un autre document.');
        if (tctSaveStatus === 'saving' || tctSaveStatus === 'dirty' || tctSaveStatus === 'error') throw new Error('Enregistrez d’abord le tableau actuel pour ne pas perdre vos modifications.');
        const run = tctRun.current;
        const result = await getSavedExtraction(currentUser.id, id);
        if (run !== tctRun.current) return;
        setTctFiles([]); setTctExtractedData([]); setTctGlobalStatus(Status.Idle);
        setTctUnifiedTable(result.table); setTctDocumentName(result.filename);
        setTctSaveStatus('saved'); setTctSaveMessage(`Document nº ${id} rechargé depuis votre compte · ${result.table.rows.length} lignes.`);
        saveRequestId.current = crypto.randomUUID();
        setTctError(result.table.metadata?.review_required ? (result.table.metadata.review_reason || 'Ancien résultat à réanalyser : colonnes potentiellement décalées.') : null); setActiveSection('tct'); setActiveTctView('document');
        if (window.matchMedia('(max-width: 1023px)').matches) setIsSidebarOpen(false);
    };

    const handleTctDeleteResult = (id: string) => {
        const updatedData = tctExtractedData.filter(item => item.id !== id);
        setTctExtractedData(updatedData);

        if (tctUnifiedTable || updatedData.length > 0) {
            const newTable = buildUnifiedTable(updatedData);
            if (newTable) {
                handleTctTableUpdate(newTable);

            } else {
                setTctUnifiedTable(null);
                setTctSaveStatus('idle'); setTctSaveMessage('');
                localStorage.removeItem('edt_tct_unified_table');
                if (activeTctView === 'document' || activeTctView === 'report') {
                    setActiveTctView('extract');
                }
            }
        }
    };

    // ========== HANDLERS OLYMEL ==========
    const handleOlymelFileChange = (selectedFiles: File[]) => {
        olymelRun.current++;
        setOlymelChangeEventCount(prev => prev + 1);
        console.log('🔵 [OLYMEL] handleOlymelFileChange called with', selectedFiles.length, 'files:', selectedFiles.map(f => f.name));
        console.log('🔵 [OLYMEL] Event count now:', olymelChangeEventCount + 1);
        setOlymelFiles(selectedFiles);
        setOlymelExtractedData([]);
        setOlymelError(null);
        setOlymelUnifiedTable(null);
        setOlymelGlobalStatus(Status.Idle);
        setActiveOlymelView('extract');
        setActiveSection('olymel');
        localStorage.removeItem('edt_olymel_unified_table');
    };

    const handleOlymelExtractData = async () => {
        console.log('🟢 [OLYMEL] handleOlymelExtractData called. Files count:', olymelFiles.length);
        if (!currentUser?.isAdmin || olymelFiles.length === 0) return;

        const run = ++olymelRun.current;
        setActiveSection('olymel');
        setActiveOlymelView('extract');
        setIsSidebarOpen(false);
        setOlymelGlobalStatus(Status.Processing);
        setOlymelExtractedData([]);
        setOlymelError(null);
        setOlymelUnifiedTable(null);
        localStorage.removeItem('edt_olymel_unified_table');

        let processableFiles: ProcessableFile[] = [];

        try {
            for (const file of olymelFiles) {
                if (file.type === 'application/pdf') {
                    const pageImages = await processPdf(file);
                    for (const page of pageImages) {
                        const prepared = await prepareImage(page.file);
                        processableFiles.push({ ...page, ...prepared });
                    }
                } else {
                    const prepared = await prepareImage(file);
                    processableFiles.push({
                        id: `${file.name}-${Date.now()}`,
                        file,
                        originalFileName: file.name,
                        ...prepared
                    });
                }
            }
        } catch (e) {
            console.error("Erreur pré-traitement Olymel", e);
            if (run !== olymelRun.current) return;
            setOlymelError(e instanceof Error ? e.message : "Erreur lors de la préparation des fichiers.");
            setOlymelGlobalStatus(Status.Error);
            return;
        }

        if (run !== olymelRun.current) return;
        setOlymelGlobalStatus(Status.AiProcessing);

        const initialDataState = processableFiles.map(f => ({
            id: f.id,
            fileName: f.originalFileName.includes(f.file.name) ? f.file.name : f.originalFileName + " (page)",
            imageSrc: `data:${f.mimeType};base64,${f.base64}`,
            content: null,
            status: Status.Processing
        }));
        setOlymelExtractedData(initialDataState);

        const promises = mapConcurrent(processableFiles, 2, async (pFile, index) => {
            try {
                if (run !== olymelRun.current) return { status: Status.Error };
                setOlymelExtractedData(prev => {
                    if (run !== olymelRun.current) return prev;
                    const newArr = [...prev];
                    if (newArr[index]) newArr[index].status = Status.AiProcessing;
                    return newArr;
                });

                const content = await extractDocumentViaN8n(pFile.base64, 'olymel', pFile.mimeType);
                const status = content.headers[0] === 'Erreur' ? Status.Error : Status.Success;

                setOlymelExtractedData(prev => {
                    if (run !== olymelRun.current) return prev;
                    const newArr = [...prev];
                    if (newArr[index]) {
                        newArr[index].content = content;
                        newArr[index].status = status;
                    }
                    return newArr;
                });

                return { status };
            } catch (e) {
                setOlymelExtractedData(prev => {
                    if (run !== olymelRun.current) return prev;
                    const newArr = [...prev];
                    if (newArr[index]) {
                        newArr[index].content = { headers: ['Erreur'], rows: [[e instanceof Error ? e.message : 'Échec extraction']] };
                        newArr[index].status = Status.Error;
                    }
                    return newArr;
                });
                return { status: Status.Error };
            }
        });

        await promises;
        if (run === olymelRun.current) setOlymelGlobalStatus(Status.Idle);
    };

    const handleOlymelGenerateResults = () => {
        try {
            if (olymelExtractedData.some(d => d.status !== Status.Success)) throw new Error('Extraction incomplète. Relancez les fichiers en erreur.');
            const unified = buildUnifiedTable(olymelExtractedData);
            if (unified) {
                setOlymelUnifiedTable(unified);
                setActiveOlymelView('calendar');

            } else {
                setOlymelError("Aucune donnée valide à afficher.");
            }
        } catch (error) {
            setOlymelError(error instanceof Error ? error.message : 'Tableau invalide.');
        }
    };

    const handleOlymelTableUpdate = (newTable: TableData) => {
        setOlymelUnifiedTable(newTable);

    };

    const handleOlymelDeleteResult = (id: string) => {
        const updatedData = olymelExtractedData.filter(item => item.id !== id);
        setOlymelExtractedData(updatedData);

        if (olymelUnifiedTable || updatedData.length > 0) {
            const newTable = buildUnifiedTable(updatedData);
            if (newTable) {
                setOlymelUnifiedTable(newTable);

            } else {
                setOlymelUnifiedTable(null);
                localStorage.removeItem('edt_olymel_unified_table');
                if (activeOlymelView === 'calendar' || activeOlymelView === 'report') {
                    setActiveOlymelView('extract');
                }
            }
        }
    };

    // ========== HANDLERS COMMUNS ==========
    const handlePrint = (headers: string[], rows: string[][]) => {
        const safe = (value: string) => value.replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]!));
        const sourceDate = activeSection === 'tct' ? tctUnifiedTable?.metadata?.schedule_date : undefined;
        const printWindow = window.open('', '', 'height=600,width=800');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Impression - ADT</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                body { font-family: sans-serif; padding: 20px; }
                table { border-collapse: collapse; width: 100%; font-size: 10px; }
                th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                h1 { color: #333; font-size: 18px; margin-bottom: 10px; }
                .meta { margin-bottom: 20px; font-size: 12px; color: #666; }
            `);
            printWindow.document.write('</style></head><body>');
            printWindow.document.write('<h1>ADT - Rapport d\'Extraction</h1>');
            printWindow.document.write(`<div class="meta">Généré le ${new Date().toLocaleString()} par ${safe(currentUser?.numDome || 'Inconnu')}</div>`);
            if (sourceDate) printWindow.document.write(`<div class="meta">Horaire source : ${safe(sourceDate)}</div>`);
            printWindow.document.write('<table>');

            printWindow.document.write('<thead><tr>');
            headers.forEach(h => printWindow.document.write(`<th>${safe(h)}</th>`));
            printWindow.document.write('</tr></thead>');

            printWindow.document.write('<tbody>');
            rows.forEach(row => {
                printWindow.document.write('<tr>');
                row.forEach(cell => printWindow.document.write(`<td>${safe(cell)}</td>`));
                printWindow.document.write('</tr>');
            });
            printWindow.document.write('</tbody></table>');

            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handleDownloadPdf = (headers: string[], rows: string[][]) => {
        const doc = new jsPDF({ orientation: 'landscape' });

        doc.setFontSize(14);
        doc.text("ADT - Rapport d'Extraction", 14, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Généré le : ${new Date().toLocaleString()} par ${currentUser?.numDome}`, 14, 22);

        const sourceDate = activeSection === 'tct' ? tctUnifiedTable?.metadata?.schedule_date : undefined;
        if (sourceDate) doc.text(`Horaire source : ${sourceDate}`, 14, 28);
        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: sourceDate ? 32 : 25,
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [2, 132, 199] },
        });

        doc.save(`ADT_Export_${activeSection.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    console.log('👤 Current user:', currentUser);

    if (!currentUser) {
        console.log('❌ No user logged in, showing AuthPage');
        return <AuthPage onLogin={handleLogin} />;
    }

    // =========================================================
    // ERROR BOUNDARY (CRITICAL FOR DEBUGGING BLACK SCREENS)
    // =========================================================
    // ... existing component ...

    console.log('✅ User logged in, showing main app');
    return (
        <GlobalErrorBoundary>
            <div className="fixed inset-0 flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
                {currentUser.isAdmin && <div className="z-50 h-14 shrink-0 flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-800 px-3 text-sm">
                    <button className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold" aria-controls="import-panel" aria-expanded={isSidebarOpen} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>{isSidebarOpen ? 'Masquer l’import' : 'Importer un document'}</button>
                    <button className="rounded-lg bg-slate-700 px-3 py-2" onClick={() => { setActiveSection('settings'); setIsSidebarOpen(false); }}>Paramètres</button>
                </div>}
                {currentUser.isAdmin && isSidebarOpen && <button type="button" className="fixed inset-0 top-14 z-30 bg-black/50" aria-label="Fermer le panneau d’import" onClick={() => setIsSidebarOpen(false)} />}
                {/* Sidebar visible uniquement pour les admins */}
                {currentUser?.isAdmin && (
                    <Sidebar
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        // TCT
                        tctFiles={tctFiles}
                        onTctFileChange={handleTctFileChange}
                        onTctExtractData={handleTctExtractData}
                        tctGlobalStatus={tctGlobalStatus}
                        isTctOpen={isTctOpen}
                        setIsTctOpen={setIsTctOpen}
                        // Olymel
                        olymelFiles={olymelFiles}
                        onOlymelFileChange={handleOlymelFileChange}
                        onOlymelExtractData={handleOlymelExtractData}
                        olymelGlobalStatus={olymelGlobalStatus}
                        isOlymelOpen={isOlymelOpen}
                        setIsOlymelOpen={setIsOlymelOpen}
                        olymelChangeEventCount={olymelChangeEventCount}
                        // Commun
                        user={currentUser}
                        onLogout={handleLogout}
                        onSectionChange={setActiveSection}
                        activeSection={activeSection}
                    />
                )}
                <MainContent
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                    // TCT
                    activeTctView={activeTctView}
                    setActiveTctView={setActiveTctView}
                    tctExtractedData={tctExtractedData}
                    onTctGenerateResults={handleTctGenerateResults}
                    onTctRetryExtraction={handleTctExtractData}
                    tctError={tctError}
                    tctSaveStatus={tctSaveStatus}
                    tctSaveMessage={tctSaveMessage}
                    historyRefresh={historyRefresh}
                    onOpenSavedDocument={handleOpenSavedDocument}
                    tctUnifiedTable={tctUnifiedTable}
                    onTctTableUpdate={handleTctTableUpdate}
                    onTctDeleteResult={handleTctDeleteResult}
                    // Olymel
                    activeOlymelView={activeOlymelView}
                    setActiveOlymelView={setActiveOlymelView}
                    olymelExtractedData={olymelExtractedData}
                    onOlymelGenerateResults={handleOlymelGenerateResults}
                    olymelError={olymelError}
                    olymelUnifiedTable={olymelUnifiedTable}
                    onOlymelTableUpdate={handleOlymelTableUpdate}
                    onOlymelDeleteResult={handleOlymelDeleteResult}
                    // Commun
                    onPrint={handlePrint}
                    onDownloadPdf={handleDownloadPdf}
                    user={currentUser}
                    onLogout={handleLogout}
                />
            </div>
        </GlobalErrorBoundary>
    );
};
