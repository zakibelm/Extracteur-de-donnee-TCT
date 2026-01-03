
/**
 * <summary>
 * Architecture refactorisée avec séparation complète TCT et Olymel
 * Chaque section a ses propres états, handlers et localStorage
 * </summary>
 */
import React, { useState, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { ExtractedData, Status, TableData } from './types';
import { extractDataFromImage } from './services/aiService';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AuthPage, User } from './components/AuthPage';

// Set worker path for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs`;

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

    const pagePromises = Array.from({ length: pdf.numPages }, (_, i) => processPage(pdf, i + 1, pdfFile.name));
    const pageResults = await Promise.all(pagePromises);

    const successfulPages = pageResults.filter((result): result is Omit<ProcessableFile, 'base64' | 'mimeType'> => result !== null);
    const failedCount = pdf.numPages - successfulPages.length;

    if (failedCount > 0) {
        console.warn(`⚠️ ${failedCount} page(s) n'ont pas pu être converties sur ${pdf.numPages}`);
    }

    console.log(`✅ ${successfulPages.length}/${pdf.numPages} pages converties avec succès`);
    console.timeEnd(`PDF_Convert_${pdfFile.name}`);

    return successfulPages;
};

const buildUnifiedTable = (extractedData: ExtractedData[]): TableData | null => {
    const validData = extractedData.filter(d => d.status === Status.Success && d.content && d.content.rows.length > 0);
    if (validData.length === 0) return null;

    const masterHeaders = validData[0].content!.headers;
    const vehiculeIndex = masterHeaders.findIndex(h => h.toLowerCase().includes('véhicule'));

    const allRows = validData.flatMap(data => {
        return data.content!.rows.map(row => {
            const newRow = [...row];
            if (vehiculeIndex !== -1) {
                const vehiculeVal = newRow[vehiculeIndex] || "";
                newRow.splice(vehiculeIndex + 1, 0, vehiculeVal, "");
            }
            return newRow;
        });
    });

    const uniqueRows = Array.from(new Set(allRows.map(row => JSON.stringify(row))))
        .map(str => JSON.parse(str as string) as string[]);

    return {
        headers: masterHeaders,
        rows: uniqueRows,
    };
};

export const App: React.FC = () => {
    console.log('🚀 App component is rendering...');

    // Auth State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Section active (TCT ou Olymel ou Settings)
    const [activeSection, setActiveSection] = useState<'tct' | 'olymel' | 'settings'>('tct');

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
    const [tctUnifiedTable, setTctUnifiedTable] = useState<TableData | null>(() => {
        try {
            const saved = localStorage.getItem('edt_tct_unified_table');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });
    const [activeTctView, setActiveTctView] = useState<'extract' | 'document' | 'report'>('extract');

    // ========== ÉTATS OLYMEL ==========
    const [olymelFiles, setOlymelFiles] = useState<File[]>([]);
    const [olymelExtractedData, setOlymelExtractedData] = useState<ExtractedData[]>([]);
    const [olymelGlobalStatus, setOlymelGlobalStatus] = useState<Status>(Status.Idle);
    const [olymelError, setOlymelError] = useState<string | null>(null);
    const [olymelUnifiedTable, setOlymelUnifiedTable] = useState<TableData | null>(() => {
        try {
            const saved = localStorage.getItem('edt_olymel_unified_table');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });
    const [activeOlymelView, setActiveOlymelView] = useState<'extract' | 'calendar' | 'report'>('extract');

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

    const handleLogout = () => {
        setCurrentUser(null);
        // Optionnel : réinitialiser tout
    };

    // ========== HANDLERS TCT ==========
    const handleTctFileChange = (selectedFiles: File[]) => {
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
        if (tctFiles.length === 0) return;

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
            setTctError("Erreur lors de la préparation des fichiers.");
            setTctGlobalStatus(Status.Error);
            return;
        }

        setTctGlobalStatus(Status.AiProcessing);

        const initialDataState = processableFiles.map(f => ({
            id: f.id,
            fileName: f.originalFileName.includes(f.file.name) ? f.file.name : f.originalFileName + " (page)",
            imageSrc: `data:${f.mimeType};base64,${f.base64}`,
            content: null,
            status: Status.Processing
        }));
        setTctExtractedData(initialDataState);

        const promises = processableFiles.map(async (pFile, index) => {
            try {
                setTctExtractedData(prev => {
                    const newArr = [...prev];
                    if (newArr[index]) newArr[index].status = Status.AiProcessing;
                    return newArr;
                });

                const content = await extractDataFromImage(pFile.base64, pFile.mimeType, 'tct');
                const status = content.headers[0] === 'Erreur' ? Status.Error : Status.Success;

                setTctExtractedData(prev => {
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

        await Promise.all(promises);
        setTctGlobalStatus(Status.Idle);
    };

    const handleTctGenerateResults = () => {
        const unified = buildUnifiedTable(tctExtractedData);
        if (unified) {
            setTctUnifiedTable(unified);
            setActiveTctView('document');
            try {
                localStorage.setItem('edt_tct_unified_table', JSON.stringify(unified));
            } catch (e) {
                console.warn("Stockage local saturé (TCT)", e);
            }
        } else {
            setTctError("Aucune donnée valide à afficher.");
        }
    };

    const handleTctTableUpdate = (newTable: TableData) => {
        setTctUnifiedTable(newTable);
        try {
            localStorage.setItem('edt_tct_unified_table', JSON.stringify(newTable));
        } catch (e) {
            console.warn("Erreur sauvegarde update TCT", e);
        }
    };

    const handleTctDeleteResult = (id: string) => {
        const updatedData = tctExtractedData.filter(item => item.id !== id);
        setTctExtractedData(updatedData);

        if (tctUnifiedTable || updatedData.length > 0) {
            const newTable = buildUnifiedTable(updatedData);
            if (newTable) {
                setTctUnifiedTable(newTable);
                try {
                    localStorage.setItem('edt_tct_unified_table', JSON.stringify(newTable));
                } catch (e) {
                    console.warn("Impossible de sauvegarder après suppression TCT", e);
                }
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
        if (olymelFiles.length === 0) return;

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
            setOlymelError("Erreur lors de la préparation des fichiers.");
            setOlymelGlobalStatus(Status.Error);
            return;
        }

        setOlymelGlobalStatus(Status.AiProcessing);

        const initialDataState = processableFiles.map(f => ({
            id: f.id,
            fileName: f.originalFileName.includes(f.file.name) ? f.file.name : f.originalFileName + " (page)",
            imageSrc: `data:${f.mimeType};base64,${f.base64}`,
            content: null,
            status: Status.Processing
        }));
        setOlymelExtractedData(initialDataState);

        const promises = processableFiles.map(async (pFile, index) => {
            try {
                setOlymelExtractedData(prev => {
                    const newArr = [...prev];
                    if (newArr[index]) newArr[index].status = Status.AiProcessing;
                    return newArr;
                });

                const content = await extractDataFromImage(pFile.base64, pFile.mimeType, 'olymel');
                const status = content.headers[0] === 'Erreur' ? Status.Error : Status.Success;

                setOlymelExtractedData(prev => {
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

        await Promise.all(promises);
        setOlymelGlobalStatus(Status.Idle);
    };

    const handleOlymelGenerateResults = () => {
        const unified = buildUnifiedTable(olymelExtractedData);
        if (unified) {
            setOlymelUnifiedTable(unified);
            setActiveOlymelView('calendar');
            try {
                localStorage.setItem('edt_olymel_unified_table', JSON.stringify(unified));
            } catch (e) {
                console.warn("Stockage local saturé (Olymel)", e);
            }
        } else {
            setOlymelError("Aucune donnée valide à afficher.");
        }
    };

    const handleOlymelTableUpdate = (newTable: TableData) => {
        setOlymelUnifiedTable(newTable);
        try {
            localStorage.setItem('edt_olymel_unified_table', JSON.stringify(newTable));
        } catch (e) {
            console.warn("Erreur sauvegarde update Olymel", e);
        }
    };

    const handleOlymelDeleteResult = (id: string) => {
        const updatedData = olymelExtractedData.filter(item => item.id !== id);
        setOlymelExtractedData(updatedData);

        if (olymelUnifiedTable || updatedData.length > 0) {
            const newTable = buildUnifiedTable(updatedData);
            if (newTable) {
                setOlymelUnifiedTable(newTable);
                try {
                    localStorage.setItem('edt_olymel_unified_table', JSON.stringify(newTable));
                } catch (e) {
                    console.warn("Impossible de sauvegarder après suppression Olymel", e);
                }
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
