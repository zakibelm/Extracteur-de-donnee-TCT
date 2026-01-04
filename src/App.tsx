/**
 * <summary>
 * Architecture refactorisée avec séparation complète TCT et Olymel
 * Backend Integration via src/services/api.ts
 * </summary>
 */
import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { SettingsView, AppSettings, DEFAULT_SETTINGS } from './components/SettingsView';
import { ExtractedData, Status, TableData, User } from './types';
import { extractDataFromImage, ExtractionOptions } from './services/geminiService';
import { api } from './services/api';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AuthPage } from './components/AuthPage';
import { ErrorBoundary } from './components/ErrorBoundary';

// Set worker path for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@5.4.394/build/pdf.worker.mjs`;

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
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
            if (blob) {
                const pageFileName = `${originalPdfName}-page-${pageNum}.jpg`;
                const pageFile = new File([blob], pageFileName, { type: 'image/jpeg' });
                console.log(`✅ Page ${pageNum} convertie avec succès`);
                return { file: pageFile, originalFileName: originalPdfName, id: `${pageFileName}-${Date.now()}` };
            }
        }
        return null;
    } catch (error) {
        console.error(`Erreur lors du traitement de la page ${pageNum} de ${originalPdfName}`, error);
        if (retryCount < 2) {
            console.warn(`🔄 Nouvelle tentative pour la page ${pageNum}...`);
            return processPage(pdf, pageNum, originalPdfName, retryCount + 1);
        }
        return null;
    }
}

/**
 * Converts all pages of a PDF file into an array of image files in parallel.
 */
const processPdf = async (pdfFile: File): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'>[]> => {
    console.time(`PDF_Convert_${pdfFile.name}`);
    const fileBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(fileBuffer).promise;

    const pagePromises = Array.from({ length: pdf.numPages }, (_, i) => processPage(pdf, i + 1, pdfFile.name));
    const pageResults = await Promise.all(pagePromises);

    console.timeEnd(`PDF_Convert_${pdfFile.name}`);
    return pageResults.filter((result): result is Omit<ProcessableFile, 'base64' | 'mimeType'> => result !== null);
};

// Helper function to build unified table logic
const buildUnifiedTable = (dataList: ExtractedData[]): TableData | null => {
    const successfulExtractions = dataList
        .filter(d => d.status === Status.Success && d.content && d.content.rows.length > 0 && d.content.headers[0] !== 'Erreur');

    if (successfulExtractions.length === 0) {
        return null;
    }

    const masterHeaders = [...successfulExtractions[0].content!.headers];

    const vehiculeIndex = masterHeaders.indexOf("Véhicule");

    if (vehiculeIndex !== -1) {
        if (!masterHeaders.includes("Changement")) {
            masterHeaders.splice(vehiculeIndex + 1, 0, "Changement");
        }
        if (!masterHeaders.includes("Changement par")) {
            masterHeaders.splice(vehiculeIndex + 2, 0, "Changement par");
        }
    }

    let allRows = successfulExtractions.flatMap(d => {
        return d.content!.rows.map(row => {
            const newRow = [...row];

            if (vehiculeIndex !== -1) {
                const vehiculeVal = newRow[vehiculeIndex] || "";
                // Insertion : Changement (init avec valeur actuelle), Changement par (init vide)
                newRow.splice(vehiculeIndex + 1, 0, vehiculeVal, "");
            }
            return newRow;
        });
    });

    // Deduplication simple basée sur le contenu JSON de la ligne
    const uniqueRows = Array.from(new Set(allRows.map(row => JSON.stringify(row))))
        .map(str => JSON.parse(str as string) as string[]);

    return {
        headers: masterHeaders,
        rows: uniqueRows,
    };
};

export const App: React.FC = () => {
    // Auth State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 1024);

    // Update on resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };
        // Optionnel : ne pas attacher si on veut laisser l'utilisateur choisir, 
        // mais pour une "app" feel, c'est mieux de s'adapter.
        // window.addEventListener('resize', handleResize);
        // return () => window.removeEventListener('resize', handleResize);
        // NOTE: On laisse l'utilisateur gèrer après le load initial pour ne pas être intrusif.
    }, []);

    // Section active (TCT ou Olymel ou Settings)
    const [activeSection, setActiveSection] = useState<'tct' | 'olymel' | 'settings'>('tct');

    // Accordion State
    const [isTctOpen, setIsTctOpen] = useState(true);
    const [isOlymelOpen, setIsOlymelOpen] = useState(false);

    // DEBUG: Event counters
    const [olymelChangeEventCount, setOlymelChangeEventCount] = useState(0);

    // Settings State
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const saved = localStorage.getItem('edt_settings');
            return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
        } catch (e) {
            return DEFAULT_SETTINGS;
        }
    });

    // Persist Settings
    useEffect(() => {
        localStorage.setItem('edt_settings', JSON.stringify(settings));
    }, [settings]);

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


    // Initial Data Load
    useEffect(() => {
        const savedUser = localStorage.getItem('edt_user');
        if (savedUser) {
            const user = JSON.parse(savedUser);
            setCurrentUser(user);
            // Fetch backend data
            loadHistory(user.numDome);
        }
    }, []);

    const loadHistory = async (userId: string) => {
        try {
            const tctData = await api.fetchExtractions(userId, 'tct');
            setTctExtractedData(tctData);

            const olymelData = await api.fetchExtractions(userId, 'olymel');
            setOlymelExtractedData(olymelData);
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }

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

    // Handlers Auth
    const handleLogin = (user: User) => {
        setCurrentUser(user);
        loadHistory(user.numDome);
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('edt_user');

        // Reset states
        setTctFiles([]);
        setTctExtractedData([]);
        setTctUnifiedTable(null);
        setTctGlobalStatus(Status.Idle);

        setOlymelFiles([]);
        setOlymelExtractedData([]);
        setOlymelUnifiedTable(null);
        setOlymelGlobalStatus(Status.Idle);
    };

    // ========== HANDLERS TCT ==========
    const handleTctFileChange = (selectedFiles: File[]) => {
        setTctFiles(selectedFiles);
        setTctExtractedData((prev) => prev); // Don't clear immediately, just append new files in extract logic
        setTctError(null);
        setTctGlobalStatus(Status.Idle);
        setActiveTctView('extract');
        setActiveSection('tct');
    };

    const handleDeleteResult = async (id: string, section: 'tct' | 'olymel') => {
        try {
            await api.deleteExtraction(id);
            if (section === 'tct') {
                const updatedData = tctExtractedData.filter(item => item.id !== id);
                setTctExtractedData(updatedData);

                if (tctUnifiedTable || updatedData.length > 0) {
                    const newTable = buildUnifiedTable(updatedData);
                    setTctUnifiedTable(newTable);
                }
            } else {
                const updatedData = olymelExtractedData.filter(item => item.id !== id);
                setOlymelExtractedData(updatedData);

                if (olymelUnifiedTable || updatedData.length > 0) {
                    const newTable = buildUnifiedTable(updatedData);
                    setOlymelUnifiedTable(newTable);
                }
            }
        } catch (e: any) {
            console.error(e);
            alert("Erreur lors de la suppression");
        }
    }


    const handleTctExtractData = async () => {
        if (tctFiles.length === 0) return;

        setTctGlobalStatus(Status.Processing);

        let currentHistory = [...tctExtractedData]; // Persist history
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
            console.error("Erreur pré-traitement", e);
            setTctError("Erreur lors de la préparation des fichiers.");
            setTctGlobalStatus(Status.Error);
            return;
        }

        setTctGlobalStatus(Status.AiProcessing);

        // Initialiser l'état avec des placeholders
        const placeholders = processableFiles.map(f => ({
            id: f.id, // Temp ID
            fileName: f.originalFileName.includes(f.file.name) ? f.file.name : f.originalFileName + " (page)",
            imageSrc: `data:${f.mimeType};base64,${f.base64}`,
            content: null,
            status: Status.Processing
        }));

        // Append new items to top
        setTctExtractedData([...placeholders, ...currentHistory]);

        // Traitement parallèle
        const promises = processableFiles.map(async (pFile, index) => {
            try {
                setTctExtractedData(prev => prev.map(p => p.id === pFile.id ? { ...p, status: Status.AiProcessing } : p));

                const options: ExtractionOptions = {
                    apiKey: settings.openRouterApiKey,
                    model: settings.aiModel,
                    systemPrompt: settings.systemPromptTct
                };

                const content = await extractDataFromImage(pFile.base64, pFile.mimeType, 'tct', options);
                const status = content.headers[0] === 'Erreur' ? Status.Error : Status.Success;

                // SAVE TO BACKEND
                const savedRecord = await api.saveExtraction({
                    id: '', // DB assigned
                    fileName: pFile.originalFileName,
                    imageSrc: '',
                    content,
                    status,
                    userId: currentUser!.numDome,
                    section: 'tct'
                }, currentUser!.numDome, 'tct');

                // Update with real ID
                setTctExtractedData(prev => prev.map(p => p.id === pFile.id ? {
                    ...savedRecord,
                    imageSrc: `data:${pFile.mimeType};base64,${pFile.base64}`
                } : p));

                return { status };
            } catch (e) {
                setTctExtractedData(prev => prev.map(p => p.id === pFile.id ? {
                    ...p,
                    content: { headers: ['Erreur'], rows: [['Echec extraction']] },
                    status: Status.Error
                } : p));
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
        } else {
            setTctError("Aucune donnée valide à afficher.");
        }
    };

    const handleTctTableUpdate = (newTable: TableData) => {
        setTctUnifiedTable(newTable);
    }


    // ========== HANDLERS OLYMEL ==========
    const handleOlymelFileChange = (selectedFiles: File[]) => {
        setOlymelFiles(selectedFiles);
        setOlymelError(null);
        setOlymelGlobalStatus(Status.Idle);
        setActiveOlymelView('extract');
        setActiveSection('olymel');
    };

    const handleOlymelExtractData = async () => {
        if (olymelFiles.length === 0) return;

        setOlymelGlobalStatus(Status.Processing);
        let currentHistory = [...olymelExtractedData];
        let processableFiles: ProcessableFile[] = [];

        try {
            for (const file of olymelFiles) {
                if (file.type === 'application/pdf') {
                    const pageImages = await processPdf(file);
                    for (const page of pageImages) {
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => { resolve((reader.result as string).split(',')[1]); };
                            reader.readAsDataURL(page.file);
                        });
                        processableFiles.push({ ...page, base64, mimeType: 'image/jpeg' });
                    }
                } else {
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => { resolve((reader.result as string).split(',')[1]); };
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
            setOlymelError("Erreur pre-traitement");
            setOlymelGlobalStatus(Status.Error);
            return;
        }

        setOlymelGlobalStatus(Status.AiProcessing);

        const placeholders = processableFiles.map(f => ({
            id: f.id,
            fileName: f.originalFileName.includes(f.file.name) ? f.file.name : f.originalFileName + " (page)",
            imageSrc: `data:${f.mimeType};base64,${f.base64}`,
            content: null,
            status: Status.Processing
        }));
        setOlymelExtractedData([...placeholders, ...currentHistory]);

        const promises = processableFiles.map(async (pFile, index) => {
            setOlymelExtractedData(prev => prev.map(p => p.id === pFile.id ? { ...p, status: Status.AiProcessing } : p));

            try {
                const options: ExtractionOptions = {
                    apiKey: settings.openRouterApiKey,
                    model: settings.aiModel,
                    systemPrompt: settings.systemPromptOlymel
                };

                const content = await extractDataFromImage(pFile.base64, pFile.mimeType, 'olymel', options);
                const status = content.headers[0] === 'Erreur' ? Status.Error : Status.Success;

                const savedRecord = await api.saveExtraction({
                    id: '',
                    fileName: pFile.originalFileName,
                    imageSrc: '',
                    content,
                    status,
                    userId: currentUser!.numDome,
                    section: 'olymel'
                }, currentUser!.numDome, 'olymel');

                setOlymelExtractedData(prev => prev.map(p => p.id === pFile.id ? {
                    ...savedRecord,
                    imageSrc: `data:${pFile.mimeType};base64,${pFile.base64}`
                } : p));

            } catch (e) {
                setOlymelExtractedData(prev => prev.map(p => p.id === pFile.id ? {
                    ...p,
                    content: { headers: ['Erreur'], rows: [['Echec']] },
                    status: Status.Error
                } : p));
            }
        });

        await Promise.all(promises);
        setOlymelGlobalStatus(Status.Idle);
    }

    const handleOlymelGenerateResults = () => {
        const unified = buildUnifiedTable(olymelExtractedData);
        if (unified) {
            setOlymelUnifiedTable(unified);
            setActiveOlymelView('calendar');
        } else {
            setOlymelError("Aucune donnée valide à afficher.");
        }
    };


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
            headStyles: { fillColor: [2, 132, 199] }, // sky-600
        });

        doc.save(`ADT_Export_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (!currentUser) {
        return <AuthPage onLogin={handleLogin} />;
    }

    return (
        <ErrorBoundary>
            <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
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

                        // Common
                        user={currentUser}
                        onLogout={handleLogout}
                        onSectionChange={setActiveSection}
                        activeSection={activeSection}
                    />
                )}
                {/* Mobile Toggle Trigger (when sidebar is hidden or user closes it) */}
                {currentUser?.isAdmin && !isSidebarOpen && (
                    <div className="fixed top-4 left-4 z-40 lg:hidden">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 bg-slate-800 text-white rounded-lg shadow-lg border border-slate-700"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        </button>
                    </div>
                )}

                {activeSection === 'settings' ? (
                    <SettingsView settings={settings} onSave={setSettings} />
                ) : (
                    <MainContent
                        activeSection={activeSection as 'tct' | 'olymel'} // Cast safe because we handle settings above
                        setActiveSection={(section) => setActiveSection(section as any)} // Legacy support 

                        // TCT Props
                        activeTctView={activeTctView}
                        setActiveTctView={setActiveTctView}
                        tctExtractedData={tctExtractedData}
                        onTctGenerateResults={handleTctGenerateResults}
                        tctError={tctError}
                        tctUnifiedTable={tctUnifiedTable}
                        onTctTableUpdate={handleTctTableUpdate}
                        onTctDeleteResult={(id) => handleDeleteResult(id, 'tct')}

                        // Olymel Props
                        activeOlymelView={activeOlymelView}
                        setActiveOlymelView={setActiveOlymelView}
                        olymelExtractedData={olymelExtractedData}
                        onOlymelGenerateResults={handleOlymelGenerateResults}
                        olymelError={olymelError}
                        olymelUnifiedTable={olymelUnifiedTable}
                        onOlymelTableUpdate={() => { }}
                        onOlymelDeleteResult={(id) => handleDeleteResult(id, 'olymel')}

                        // Common
                        onPrint={handlePrint}
                        onDownloadPdf={handleDownloadPdf}
                        user={currentUser}
                        onLogout={handleLogout}
                    />
                )}
            </div>
        </ErrorBoundary>
    );
};
