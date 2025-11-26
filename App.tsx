
/**
 * <summary>
 * Gain de performance : Le traitement des pages PDF est maintenant parallélisé.
 * Robustesse accrue : Gestion des erreurs par page et sauvegarde sécurisée (localStorage).
 * Optimisation : SAFETY MODE RÉSEAU -> Compression drastique (< 500Ko) pour passer sur tous les réseaux mobiles.
 * </summary>
 */
import React, { useState, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { ExtractedData, Status, TableData } from './types';
import { extractDataFromImage } from './services/geminiService';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AuthPage, User } from './components/AuthPage';

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
 * Optimise une image de manière ADAPTATIVE pour garantir l'envoi API sur MOBILE.
 * ULTRA-LIGHT MODE :
 * 1. Résolution MAX de départ : 800px (Suffisant pour lecture OCR, très léger).
 * 2. Cible : Moins de 350Ko (0.35MB) pour passer instantanément.
 */
const optimizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    reject(new Error("Impossible de créer le contexte canvas"));
                    return;
                }

                // Initial settings - MODE ULTRA-LIGHT
                let width = img.width;
                let height = img.height;
                let quality = 0.6; 
                const MAX_START_WIDTH = 800; // 800px suffit largement pour du texte A4

                // Initial resize if huge
                if (width > MAX_START_WIDTH) {
                    const scale = MAX_START_WIDTH / width;
                    width = MAX_START_WIDTH;
                    height = height * scale;
                }

                // Target: Under 350KB to be absolutely safe for mobile 3G/4G
                const MAX_BASE64_LENGTH = 450000; // ~350KB payload
                let dataUrl = "";
                let attempt = 0;
                let success = false;

                // Adaptive Loop
                while (attempt < 6 && !success) {
                    canvas.width = width;
                    canvas.height = height;
                    
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'medium'; // 'high' consomme trop de mémoire sur mobile
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                    
                    // Check size
                    const base64Content = dataUrl.split(',')[1];
                    
                    if (base64Content.length <= MAX_BASE64_LENGTH) {
                        success = true;
                        resolve(base64Content);
                    } else {
                        // Too big, reduce aggressively
                        width *= 0.8; // -20% size
                        height *= 0.8;
                        quality -= 0.1; // -10% quality
                        if (quality < 0.3) quality = 0.3; // Min quality floor
                        attempt++;
                    }
                }

                if (!success) {
                    // Fail-safe
                    resolve(dataUrl.split(',')[1]);
                }
                
                // Cleanup
                canvas.width = 0;
                canvas.height = 0;
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

/**
 * Processes a single page of a PDF document into an image File object.
 * Forces output to match the constraints (approx 800px width).
 */
async function processPage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, originalPdfName: string): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'> | null> {
    try {
        const page = await pdf.getPage(pageNum);
        
        // Scale 1.4 sur A4 ~ 830px de large. Très léger.
        const viewport = page.getViewport({ scale: 1.4 }); 
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            // Compression quality 0.5 direct pour être ultra léger
            const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.5));
            
            // Clean up canvas
            canvas.width = 0;
            canvas.height = 0;
            
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
 * Converts PDF pages in batches.
 */
const processPdf = async (pdfFile: File): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'>[]> => {
    console.time(`PDF_Convert_${pdfFile.name}`);
    const fileBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(fileBuffer).promise;
    
    const results: Omit<ProcessableFile, 'base64' | 'mimeType'>[] = [];
    const BATCH_SIZE = 2; 

    for (let i = 0; i < pdf.numPages; i += BATCH_SIZE) {
        const batchPromises = [];
        for (let j = 0; j < BATCH_SIZE && (i + j) < pdf.numPages; j++) {
            batchPromises.push(processPage(pdf, i + j + 1, pdfFile.name));
        }
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(res => {
            if (res) results.push(res);
        });
    }

    console.timeEnd(`PDF_Convert_${pdfFile.name}`);
    return results;
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

    // Deduplication simple
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

    const [unifiedTable, setUnifiedTable] = useState<TableData | null>(() => {
        try {
            const savedTable = localStorage.getItem('edt_unified_table');
            return savedTable ? JSON.parse(savedTable) : null;
        } catch (e) {
            console.error("Erreur chargement localStorage", e);
            return null;
        }
    });

    const [activeView, setActiveView] = useState<'extract' | 'document' | 'report'>('extract');

    useEffect(() => {
        if (unifiedTable && extractedData.length === 0) {
            setActiveView('document');
        }
    }, []);

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
        setActiveView('extract');
        localStorage.removeItem('edt_unified_table');
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
                     console.warn("Quota storage exceeded", e);
                }
            } else {
                setUnifiedTable(null);
                localStorage.removeItem('edt_unified_table');
                if (activeView === 'document' || activeView === 'report') {
                     setActiveView('extract');
                }
            }
        }
    };

    const handleExtractData = async () => {
        if (files.length === 0) return;

        setGlobalStatus(Status.Processing);
        setExtractedData([]);
        setError(null);
        setUnifiedTable(null); 
        localStorage.removeItem('edt_unified_table');
        
        let processableFiles: ProcessableFile[] = [];
        
        try {
            // STEP 1: Pre-processing (Compression / Conversion)
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
                    // OPTIMISATION SYSTÉMATIQUE ET ADAPTATIVE (ULTRA-LIGHT)
                    try {
                        const base64 = await optimizeImage(file);
                        processableFiles.push({ 
                            id: `${file.name}-${Date.now()}`,
                            file, 
                            originalFileName: file.name, 
                            base64, 
                            mimeType: 'image/jpeg' 
                        });
                    } catch (optError) {
                        console.error(`Erreur d'optimisation pour ${file.name}`, optError);
                        // Fallback simple
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
            }
        } catch (e) {
            console.error("Erreur pré-traitement", e);
            setError("Erreur lors de la préparation des fichiers.");
            setGlobalStatus(Status.Error);
            return;
        }

        setGlobalStatus(Status.AiProcessing);
        
        const initialDataState = processableFiles.map(f => ({
            id: f.id,
            fileName: f.originalFileName.includes(f.file.name) ? f.file.name : f.originalFileName + " (page)",
            imageSrc: `data:${f.mimeType};base64,${f.base64}`,
            content: null,
            status: Status.Processing 
        }));
        setExtractedData(initialDataState);

        // STEP 2: AI Processing - SEQUENTIAL (1 by 1)
        const CONCURRENCY_LIMIT = 1; 
        
        for (let i = 0; i < processableFiles.length; i += CONCURRENCY_LIMIT) {
            const batch = processableFiles.slice(i, i + CONCURRENCY_LIMIT);
            
            const batchPromises = batch.map(async (pFile) => {
                const index = processableFiles.indexOf(pFile);
                
                try {
                     setExtractedData(prev => prev.map((item, idx) => 
                        idx === index ? { ...item, status: Status.AiProcessing } : item
                     ));

                     const content = await extractDataFromImage(pFile.base64, pFile.mimeType);
                     const status = content.headers[0] === 'Erreur' ? Status.Error : Status.Success;
                     
                     setExtractedData(prev => prev.map((item, idx) => 
                        idx === index ? { ...item, content: content, status: status } : item
                     ));
                     return { status };
                } catch (e) {
                     setExtractedData(prev => prev.map((item, idx) => 
                        idx === index ? { ...item, content: { headers: ['Erreur'], rows: [['Echec extraction']] }, status: Status.Error } : item
                     ));
                     return { status: Status.Error };
                }
            });

            await Promise.all(batchPromises);
        }

        setGlobalStatus(Status.Idle);
    };

    const handleGenerateResults = () => {
        const unified = buildUnifiedTable(extractedData);
        if (unified) {
            setUnifiedTable(unified);
            setActiveView('document');
            try {
                localStorage.setItem('edt_unified_table', JSON.stringify(unified));
            } catch (e) {
                console.warn("Stockage local saturé", e);
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

    const handlePrint = (headers: string[], rows: string[][]) => {
        const printWindow = window.open('', '', 'height=600,width=800');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Impression - ADT</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                @page { size: landscape; margin: 5mm; }
                body { font-family: sans-serif; padding: 10px; -webkit-print-color-adjust: exact; }
                table { border-collapse: collapse; width: 100%; font-size: 5pt; table-layout: fixed; }
                th, td { border: 1px solid #333; padding: 2px; text-align: left; overflow: hidden; white-space: nowrap; }
                th { background-color: #eee; font-weight: bold; }
                h1 { font-size: 14px; margin-bottom: 5px; }
                .meta { margin-bottom: 10px; font-size: 8px; color: #666; }
                @media print { body { zoom: 55%; } }
            `);
            printWindow.document.write('</style></head><body>');
            printWindow.document.write('<h1>ADT - Rapport d\'Extraction</h1>');
            printWindow.document.write(`<div class="meta">Généré le ${new Date().toLocaleString()} par ${currentUser?.numDome || 'Inconnu'}</div>`);
            printWindow.document.write('<table>');
            printWindow.document.write('<thead><tr>');
            headers.forEach(h => printWindow.document.write(`<th>${h}</th>`));
            printWindow.document.write('</tr></thead><tbody>');
            rows.forEach(row => {
                printWindow.document.write('<tr>');
                row.forEach(cell => printWindow.document.write(`<td>${cell}</td>`));
                printWindow.document.write('</tr>');
            });
            printWindow.document.write('</tbody></table></body></html>');
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); }, 500);
        }
    };

    const handleDownloadPdf = (headers: string[], rows: string[][]) => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFontSize(10);
        doc.text("ADT - Rapport d'Extraction", 10, 10);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Généré le : ${new Date().toLocaleString()} par ${currentUser?.numDome}`, 10, 15);

        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 20,
            styles: { fontSize: 5, cellPadding: 1, overflow: 'linebreak' },
            headStyles: { fillColor: [2, 132, 199], textColor: 255 },
            columnStyles: { 12: { cellWidth: 20 }, 13: { cellWidth: 20 } },
            margin: { top: 20, left: 5, right: 5, bottom: 5 },
            theme: 'grid'
        });

        doc.save(`ADT_Export_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    if (!currentUser) {
        return <AuthPage onLogin={handleLogin} />;
    }

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
            <Sidebar 
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                files={files}
                onFileChange={handleFileChange}
                onExtractData={handleExtractData}
                globalStatus={globalStatus}
                user={currentUser}
                onLogout={handleLogout}
            />
            <MainContent 
                activeView={activeView}
                setActiveView={setActiveView}
                extractedData={extractedData}
                onGenerateResults={handleGenerateResults}
                error={error}
                unifiedTable={unifiedTable}
                onPrint={handlePrint}
                onDownloadPdf={handleDownloadPdf}
                onTableUpdate={handleTableUpdate}
                user={currentUser}
                onDeleteResult={handleDeleteResult}
            />
        </div>
    );
};
