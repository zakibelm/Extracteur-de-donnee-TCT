/**
 * <summary>
 * Gain de performance : Le traitement des pages PDF est maintenant parallélisé.
 * Robustesse accrue : Gestion des erreurs par page et sauvegarde sécurisée (localStorage).
 * </summary>
 */
import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Sidebar, AppSection } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { SettingsView, AppSettings, DEFAULT_SETTINGS } from './components/SettingsView';
import { ExtractedData, Status, TableData, User } from './types';
import { extractDataFromImage, ExtractionOptions } from './services/geminiService';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AuthPage } from './components/AuthPage';

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
async function processPage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, originalPdfName: string): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'> | null> {
    try {
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
                return { file: pageFile, originalFileName: originalPdfName, id: `${pageFileName}-${Date.now()}` };
            }
        }
        return null;
    } catch (error) {
        console.error(`Erreur lors du traitement de la page ${pageNum} de ${originalPdfName}`, error);
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

    const [files, setFiles] = useState<File[]>([]);
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [globalStatus, setGlobalStatus] = useState<Status>(Status.Idle);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Initialisation différée pour récupérer le tableau sauvegardé
    const [unifiedTable, setUnifiedTable] = useState<TableData | null>(() => {
        try {
            const savedTable = localStorage.getItem('edt_unified_table');
            return savedTable ? JSON.parse(savedTable) : null;
        } catch (e) {
            console.error("Erreur lors du chargement du tableau depuis le stockage local", e);
            return null;
        }
    });

    // App Navigation & Settings
    const [activeSection, setActiveSection] = useState<AppSection>('tct');
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

    // TCT State
    const [activeTctView, setActiveTctView] = useState<'extract' | 'document' | 'report'>('extract');

    // Olymel States (Placeholder for now based on inferred logic)
    const [activeOlymelView, setActiveOlymelView] = useState<'extract' | 'calendar' | 'report'>('extract');
    const [olymelExtractedData, setOlymelExtractedData] = useState<ExtractedData[]>([]);
    const [olymelUnifiedTable, setOlymelUnifiedTable] = useState<TableData | null>(null);


    // Effet pour basculer automatiquement sur la vue document si un tableau est restauré
    useEffect(() => {
        if (unifiedTable && extractedData.length === 0) {
            setActiveTctView('document');
        }
    }, []);

    // Effet pour basculer les non-admins vers la vue document
    useEffect(() => {
        if (currentUser && !currentUser.isAdmin) {
            setActiveTctView('document');
        }
    }, [currentUser]);

    // Handlers Auth
    const handleLogin = (user: User) => {
        setCurrentUser(user);
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setFiles([]);
        setExtractedData([]);
        setUnifiedTable(null);
        setGlobalStatus(Status.Idle);
        localStorage.removeItem('edt_unified_table');
    };

    const handleFileChange = (selectedFiles: File[]) => {
        setFiles(selectedFiles);
        setExtractedData([]);
        setError(null);
        setUnifiedTable(null);
        setGlobalStatus(Status.Idle);
        // Reset view based on section
        if (activeSection === 'tct') setActiveTctView('extract');
        if (activeSection === 'olymel') setActiveOlymelView('extract');
        localStorage.removeItem('edt_unified_table'); // Réinitialisation au nouvel import
    };

    const handleDeleteResult = (id: string) => {
        const updatedData = extractedData.filter(item => item.id !== id);
        setExtractedData(updatedData);

        if (unifiedTable || updatedData.length > 0) {
            const newTable = buildUnifiedTable(updatedData);
            if (newTable) {
                setUnifiedTable(newTable);
                try {
                    localStorage.setItem('edt_unified_table', JSON.stringify(newTable));
                } catch (e) {
                    console.warn("Impossible de sauvegarder après suppression (Quota ?)", e);
                }
            } else {
                setUnifiedTable(null);
                localStorage.removeItem('edt_unified_table');
                if (activeTctView === 'document' || activeTctView === 'report') {
                    setActiveTctView('extract');
                }
            }
        };
    };

    const handleExtractData = async () => {
        if (files.length === 0) return;

        setGlobalStatus(Status.Processing);
        setExtractedData([]);
        setError(null);
        setUnifiedTable(null);

        // Nettoyage préventif
        localStorage.removeItem('edt_unified_table');

        let processableFiles: ProcessableFile[] = [];

        try {
            for (const file of files) {
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
            setError("Erreur lors de la préparation des fichiers.");
            setGlobalStatus(Status.Error);
            return;
        }

        setGlobalStatus(Status.AiProcessing);

        // Initialiser l'état avec des placeholders pour afficher le chargement
        const initialDataState = processableFiles.map(f => ({
            id: f.id,
            fileName: f.originalFileName.includes(f.file.name) ? f.file.name : f.originalFileName + " (page)",
            imageSrc: `data:${f.mimeType};base64,${f.base64}`,
            content: null,
            status: Status.Processing // Changé à AiProcessing individuellement si besoin
        }));
        setExtractedData(initialDataState);

        // Traitement parallèle
        const promises = processableFiles.map(async (pFile, index) => {
            try {
                // Petite mise à jour pour dire que cette image spécifique est chez l'IA
                setExtractedData(prev => {
                    const newArr = [...prev];
                    if (newArr[index]) newArr[index].status = Status.AiProcessing;
                    return newArr;
                });

                // Determine document type based on section
                const docType = activeSection === 'olymel' ? 'olymel' : 'tct';

                // Prepare Options with Settings
                const options: ExtractionOptions = {
                    apiKey: settings.openRouterApiKey,
                    model: settings.aiModel,
                    systemPrompt: activeSection === 'olymel' ? settings.systemPromptOlymel : settings.systemPromptTct
                };

                const content = await extractDataFromImage(pFile.base64, pFile.mimeType, docType, options);

                const status = content.headers[0] === 'Erreur' ? Status.Error : Status.Success;

                setExtractedData(prev => {
                    const newArr = [...prev];
                    if (newArr[index]) {
                        newArr[index].content = content;
                        newArr[index].status = status;
                    }
                    return newArr;
                });

                return { status };
            } catch (e) {
                setExtractedData(prev => {
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
        setGlobalStatus(Status.Idle);
    };

    const handleGenerateResults = () => {
        const unified = buildUnifiedTable(extractedData);
        if (unified) {
            setUnifiedTable(unified);
            setActiveTctView('document');
            try {
                localStorage.setItem('edt_unified_table', JSON.stringify(unified));
            } catch (e) {
                console.warn("Stockage local saturé, impossible de sauvegarder le document final.", e);
                // On pourrait notifier l'utilisateur ici
            }
        } else {
            setError("Aucune donnée valide à afficher.");
        }
    };

    const handleTableUpdate = (newTable: TableData) => {
        setUnifiedTable(newTable);
        try {
            localStorage.setItem('edt_unified_table', JSON.stringify(newTable));
        } catch (e) {
            console.warn("Erreur sauvegarde update", e);
        }
    };

    // Placeholder handlers for Olymel
    const handleOlymelGenerateResults = () => {
        // Implement Olymel unification logic here if different
        const unified = buildUnifiedTable(extractedData);
        setOlymelUnifiedTable(unified);
        setActiveOlymelView('calendar');
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
            headStyles: { fillColor: [2, 132, 199] }, // sky-600
        });

        doc.save(`ADT_Export_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (!currentUser) {
        return <AuthPage onLogin={handleLogin} />;
    }

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
            {/* Sidebar visible uniquement pour les admins */}
            {currentUser?.isAdmin && (
                <Sidebar
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    activeSection={activeSection}
                    onNavigate={setActiveSection}
                    files={files}
                    onFileChange={handleFileChange}
                    onExtractData={handleExtractData}
                    globalStatus={globalStatus}
                    user={currentUser}
                    onLogout={handleLogout}
                />
            )}

            {activeSection === 'settings' ? (
                <SettingsView settings={settings} onSave={setSettings} />
            ) : (
                <MainContent
                    activeSection={activeSection as 'tct' | 'olymel'} // Only tct or olymel passed here
                    setActiveSection={(section) => setActiveSection(section)} // Allow MainContent to switch? (Maybe not needed if sidebar does it)

                    // TCT Props
                    activeTctView={activeTctView}
                    setActiveTctView={setActiveTctView}
                    tctExtractedData={extractedData} // Using shared state for now
                    onTctGenerateResults={handleGenerateResults}
                    tctError={error}
                    tctUnifiedTable={unifiedTable}
                    onTctTableUpdate={handleTableUpdate}
                    onTctDeleteResult={handleDeleteResult}

                    // Olymel Props
                    activeOlymelView={activeOlymelView}
                    setActiveOlymelView={setActiveOlymelView}
                    olymelExtractedData={olymelExtractedData}
                    onOlymelGenerateResults={handleOlymelGenerateResults}
                    olymelError={null}
                    olymelUnifiedTable={olymelUnifiedTable}
                    onOlymelTableUpdate={() => { }} // Placeholder
                    onOlymelDeleteResult={() => { }} // Placeholder

                    // Common
                    onPrint={handlePrint}
                    onDownloadPdf={handleDownloadPdf}
                    user={currentUser}
                    onLogout={handleLogout}
                />
            )}
        </div>
    );
};
