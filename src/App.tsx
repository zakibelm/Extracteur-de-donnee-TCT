
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

export const App: React.FC = () => {
    console.log('🚀 App component is rendering...');

    const saveRequestId = useRef(crypto.randomUUID());
    const saving = useRef(false);
    const tctRun = useRef(0);
    const olymelRun = useRef(0);
    // Auth State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
        setTctUnifiedTable(null);
        setOlymelUnifiedTable(null);
        setTctExtractedData([]);
        setOlymelExtractedData([]);
        setTctFiles([]);
        setOlymelFiles([]);
        saveRequestId.current = crypto.randomUUID();
    }, [currentUser?.id]);

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
        tctRun.current++;
        saveRequestId.current = crypto.randomUUID();
        setTctFiles(selectedFiles);
        setTctExtractedData([]);
        setTctError(null);
        setTctUnifiedTable(null);
        setTctGlobalStatus(Status.Idle);
        setActiveTctView('extract');
        setActiveSection('tct');
        localStorage.removeItem('edt_tct_unified_table');
    };

    const handleTctExtractData = async () => {
        if (!currentUser?.isAdmin || tctFiles.length === 0) return;

        saveRequestId.current = crypto.randomUUID();
        const run = ++tctRun.current;
        setTctGlobalStatus(Status.Processing);
        setTctExtractedData([]);
        setTctError(null);
        setTctUnifiedTable(null);
        localStorage.removeItem('edt_tct_unified_table');

        let processableFiles: ProcessableFile[] = [];

        try {
            for (const file of tctFiles) {
                if (file.type === 'application/pdf') {
                    const pageImages = await processPdf(file);
                    for (const page of pageImages) {
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const result = reader.result as string;
                                resolve(result.split(',')[1]);
                            };
                            reader.readAsDataURL(page.file);
                        });
                        processableFiles.push({ ...page, base64, mimeType: 'image/jpeg' });
                    }
                } else {
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            resolve(result.split(',')[1]);
                        };
                        reader.readAsDataURL(file);
                    });
                    processableFiles.push({
                        id: `${file.name}-${Date.now()}`,
                        file,
                        originalFileName: file.name,
                        base64,
                        mimeType: file.type
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
                setTctExtractedData(prev => {
                    if (run !== tctRun.current) return prev;
                    const newArr = [...prev];
                    if (newArr[index]) {
                        newArr[index].content = { headers: ['Erreur'], rows: [['Echec extraction']] };
                        newArr[index].status = Status.Error;
                    }
                    return newArr;
                });
                return { status: Status.Error };
            }
        });

        await promises;
        if (run === tctRun.current) setTctGlobalStatus(Status.Idle);
    };

    const handleTctGenerateResults = async () => {
        if (saving.current) return;
        saving.current = true;
        setTctError(null);
        try {
            if (tctExtractedData.some(d => d.status !== Status.Success)) throw new Error('Extraction incomplète. Relancez les fichiers en erreur avant de sauvegarder.');
            const unified = buildUnifiedTable(tctExtractedData);
            if (unified) {
                validateTable(unified, TCT_HEADERS);
                setTctUnifiedTable(unified);


                // Sauvegarder dans Supabase
                if (currentUser) {
                    try {
                        console.log('[TCT] Sauvegarde dans Supabase...');

                        // Importer le service Supabase
                        const { saveExtractionToSupabase } = await import('./services/supabaseService');

                        // Préparer les données du document
                        const documentData = {
                            filename: tctFiles.map(f => f.name).join(', '),
                            upload_date: new Date().toISOString(),
                            status: 'success' as const,
                            user_id: currentUser.id,
                            extracted_count: unified.rows.length
                        };

                        // Préparer les données des tournées
                        const tourneesData = toTctRecords(unified);

                        // Sauvegarder dans Supabase
                        const result = await saveExtractionToSupabase({
                            document: documentData,
                            tournees: tourneesData,
                            user_id: currentUser.id,
                            request_id: saveRequestId.current,
                            metadata: unified.metadata
                        });

                        console.log('[TCT] Sauvegarde Supabase réussie:', {
                            documentId: result.documentId,
                            tourneesCount: result.tourneesCount,
                            executionTime: result.executionTime + 'ms'
                        });
                    } catch (error) {
                        console.error('[TCT] Erreur sauvegarde Supabase:', error);
                        throw new Error('Résultat non sauvegardé. Vérifiez la connexion puis réessayez.');
                    }
                }
            } else {
                setTctError("Aucune donnée valide à afficher.");
            }
            if (unified && currentUser) setActiveTctView('document');
        } catch (error) {
            setTctError(error instanceof Error ? error.message : 'Erreur de sauvegarde.');
        } finally { saving.current = false; }
    };

    const handleTctTableUpdate = (newTable: TableData) => {
        setTctUnifiedTable(newTable);

    };

    const handleTctDeleteResult = (id: string) => {
        const updatedData = tctExtractedData.filter(item => item.id !== id);
        setTctExtractedData(updatedData);

        if (tctUnifiedTable || updatedData.length > 0) {
            const newTable = buildUnifiedTable(updatedData);
            if (newTable) {
                setTctUnifiedTable(newTable);

            } else {
                setTctUnifiedTable(null);
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
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const result = reader.result as string;
                                resolve(result.split(',')[1]);
                            };
                            reader.readAsDataURL(page.file);
                        });
                        processableFiles.push({ ...page, base64, mimeType: 'image/jpeg' });
                    }
                } else {
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            resolve(result.split(',')[1]);
                        };
                        reader.readAsDataURL(file);
                    });
                    processableFiles.push({
                        id: `${file.name}-${Date.now()}`,
                        file,
                        originalFileName: file.name,
                        base64,
                        mimeType: file.type
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
                        newArr[index].content = { headers: ['Erreur'], rows: [['Echec extraction']] };
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
            printWindow.document.write(`<div class="meta">Généré le ${new Date().toLocaleString()} par ${currentUser?.numDome || 'Inconnu'}</div>`);
            printWindow.document.write('<table>');

            printWindow.document.write('<thead><tr>');
            headers.forEach(h => printWindow.document.write(`<th>${h}</th>`));
            printWindow.document.write('</tr></thead>');

            printWindow.document.write('<tbody>');
            rows.forEach(row => {
                printWindow.document.write('<tr>');
                row.forEach(cell => printWindow.document.write(`<td>${cell}</td>`));
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

        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 25,
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

    // ... existing component ...

    console.log('✅ User logged in, showing main app');
    return (
        <GlobalErrorBoundary>
            <div className="fixed inset-0 flex bg-slate-900 text-slate-100 font-sans overflow-hidden">
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
                    tctError={tctError}
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
