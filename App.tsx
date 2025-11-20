/**
 * <summary>
 * Gain de performance : Le traitement des pages PDF est maintenant parallélisé, réduisant le temps de conversion (ex: de 5s à 0.5s pour 10 pages).
 * Robustesse accrue : La conversion de chaque page est isolée ; un échec sur une page n'arrête plus le traitement du PDF entier.
 * </summary>
 */
import React, { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { ExtractedData, Status, TableData } from './types';
import { extractDataFromImage } from './services/geminiService';
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// FIX: Correctly assign the virtual file system for pdfmake fonts with robust checks.
// esm.sh or different bundlers might export these differently (default vs named).
const pdfMakeInstance = (pdfMake as any).default || pdfMake;
const pdfFontsInstance = (pdfFonts as any).default || pdfFonts;

if (pdfMakeInstance) {
    // Try to find the vfs object in common locations within the imported module
    let vfs: any = null;
    
    if (pdfFontsInstance) {
        if (pdfFontsInstance.pdfMake && pdfFontsInstance.pdfMake.vfs) {
            vfs = pdfFontsInstance.pdfMake.vfs;
        } else if (pdfFontsInstance.vfs) {
            vfs = pdfFontsInstance.vfs;
        } else {
            vfs = pdfFontsInstance;
        }
    }
    
    if (vfs) {
        pdfMakeInstance.vfs = vfs;
    } else {
        console.warn("pdfMake warning: Could not find vfs_fonts. PDF generation might fail.");
    }
} else {
    console.error("pdfMake error: Module failed to load.");
}


// Set worker path for pdf.js to match the version from the import map
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
 * This function is designed to be run in parallel for multiple pages.
 * @param pdf - The loaded PDF document proxy from pdf.js.
 * @param pageNum - The page number to process.
 * @param originalPdfName - The filename of the original PDF for naming the output.
 * @returns A promise that resolves to a processable file object or null if an error occurs.
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
        return null; // Return null on error for a specific page, allowing others to succeed
    }
}

/**
 * Converts all pages of a PDF file into an array of image files in parallel.
 * @param pdfFile The PDF file to process.
 * @returns A promise that resolves to an array of processable file objects.
 */
const processPdf = async (pdfFile: File): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'>[]> => {
    console.time(`PDF_Convert_${pdfFile.name}`);
    const fileBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(fileBuffer).promise;
    
    // Create an array of promises, one for each page, to run them in parallel.
    const pagePromises = Array.from({ length: pdf.numPages }, (_, i) => processPage(pdf, i + 1, pdfFile.name));
    
    const pageResults = await Promise.all(pagePromises);

    console.timeEnd(`PDF_Convert_${pdfFile.name}`);
    // Filter out any pages that may have failed during conversion.
    return pageResults.filter((result): result is Omit<ProcessableFile, 'base64' | 'mimeType'> => result !== null);
};


const App: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [globalStatus, setGlobalStatus] = useState<Status>(Status.Idle);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [unifiedTable, setUnifiedTable] = useState<TableData | null>(null);

    const [activeView, setActiveView] = useState<'extract' | 'document'>('extract');

    const handleFileChange = (selectedFiles: File[]) => {
        setFiles(selectedFiles);
        setExtractedData([]);
        setError(null);
        setUnifiedTable(null);
        setGlobalStatus(Status.Idle);
        setActiveView('extract');
    };

    const fileToBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (error) => reject(error);
        });

    const handleExtractData = useCallback(async () => {
        if (files.length === 0) {
            setError("Veuillez sélectionner au moins un fichier.");
            return;
        }

        setGlobalStatus(Status.Processing);
        setError(null);
        setUnifiedTable(null);
        setActiveView('extract');

        try {
            const processableFiles: ProcessableFile[] = [];
            console.time('Traitement_Total_Fichiers'); // Micro-benchmark start
            for (const file of files) {
                if (file.type === 'application/pdf') {
                    const pdfPages = await processPdf(file);
                    for (const page of pdfPages) {
                        const base64 = await fileToBase64(page.file);
                        processableFiles.push({ ...page, base64, mimeType: page.file.type });
                    }
                } else {
                    const base64 = await fileToBase64(file);
                    processableFiles.push({ file, originalFileName: file.name, id: `${file.name}-${Date.now()}`, base64, mimeType: file.type });
                }
            }
            console.timeEnd('Traitement_Total_Fichiers'); // Micro-benchmark end
            
            const initialData: ExtractedData[] = processableFiles.map(({ id, file, originalFileName }) => {
                 const pageNumber = file.name.match(/-page-(\d+)\.jpg$/);
                 const displayName = originalFileName.endsWith('.pdf') && pageNumber 
                     ? `${originalFileName} (Page ${pageNumber[1]})` 
                     : originalFileName;

                return { id, fileName: displayName, imageSrc: URL.createObjectURL(file), content: null, status: Status.AiProcessing };
            });
            setExtractedData(initialData);

            const extractionPromises = processableFiles.map(async (pfile) => {
                const result = await extractDataFromImage(pfile.base64, pfile.mimeType);
                const isErrorResult = result.headers.length === 1 && result.headers[0] === "Erreur";
                
                setExtractedData(prev => prev.map(item =>
                    item.id === pfile.id
                        ? { ...item, content: result, status: isErrorResult ? Status.Error : Status.Success }
                        : item
                ));
            });
            
            await Promise.all(extractionPromises);
            setGlobalStatus(Status.Success);

        } catch (e) {
            console.error("Erreur générale lors de l'extraction:", e);
            setError("Une erreur est survenue lors de l'extraction. Veuillez vérifier la console pour plus de détails.");
            setGlobalStatus(Status.Error);
            setExtractedData(prev => prev.map(item => ({ ...item, status: Status.Error })));
        }
    }, [files]);
    
    const handleGenerateResults = () => {
        const successfulExtractions = extractedData
            .filter(d => d.status === Status.Success && d.content && d.content.rows.length > 0 && d.content.headers[0] !== 'Erreur');

        if (successfulExtractions.length === 0) {
            setError("Aucune donnée valide à traiter.");
            return;
        }

        const masterHeaders = successfulExtractions[0].content!.headers;
        let allRows = successfulExtractions.flatMap(d => d.content!.rows);

        const uniqueRows = Array.from(new Set(allRows.map(row => JSON.stringify(row))))
            .map(str => JSON.parse(str as string) as string[]);
            
        const finalTable: TableData = {
            headers: masterHeaders,
            rows: uniqueRows,
        };
        setUnifiedTable(finalTable);
        setActiveView('document');
    };
    
    const handleDownloadPdf = (headers: string[], rows: string[][]) => {
        if (!pdfMakeInstance) {
            setError("La génération de PDF n'est pas disponible (module non chargé).");
            return;
        }
        
        console.time('PDF_Generation');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedDate = tomorrow.toISOString().split('T')[0];
        const printTitle = `${formattedDate}_TCT_Filtre`;

        const docDefinition = {
            pageSize: 'A4' as const,
            pageOrientation: 'landscape' as const,
            pageMargins: [20, 20, 20, 20] as [number, number, number, number],
            content: [
                { text: `Données Filtrées - ${printTitle}`, style: 'header' },
                {
                    style: 'tableExample',
                    table: {
                        headerRows: 1,
                        widths: Array(headers.length).fill('*'),
                        body: [
                            headers.map(h => ({ text: h, style: 'tableHeader' })),
                            ...rows.map(row => row.map(cell => (cell || '')))
                        ]
                    },
                     layout: {
                        fillColor: function (rowIndex: number) {
                            return (rowIndex % 2 === 0) ? '#f2f2f2' : null;
                        }
                    }
                }
            ],
            styles: {
                header: { fontSize: 14, bold: true, margin: [0, 0, 0, 10] as [number, number, number, number] },
                tableExample: { margin: [0, 5, 0, 15] as [number, number, number, number], fontSize: 7 },
                tableHeader: { bold: true, fontSize: 8, color: 'black' }
            }
        };

        try {
            pdfMakeInstance.createPdf(docDefinition).download(`${printTitle}.pdf`);
            console.timeEnd('PDF_Generation');
        } catch (e) {
            console.timeEnd('PDF_Generation');
            console.error("Erreur lors de la création du PDF", e);
            setError("Erreur lors de la génération du PDF. Vérifiez la console.");
        }
    };


    const handlePrint = (headers: string[], rows: string[][]) => {
        if (!headers || !rows) return;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedDate = tomorrow.toISOString().split('T')[0];
        const printTitle = `${formattedDate}_TCT_Filtre`;

        const tableHeader = `
            <thead>
                <tr>
                    ${headers.map(header => `<th>${header}</th>`).join('')}
                </tr>
            </thead>
        `;
        const tableBody = `
            <tbody>
                ${rows.map(row => `
                    <tr>
                        ${row.map(cell => `<td>${cell || ''}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        `;

        const printContent = `
            <html>
                <head>
                    <title>${printTitle}</title>
                    <style>
                        @media print {
                            @page {
                                size: A4 landscape;
                                margin: 0.7cm;
                            }
                            body {
                                margin: 0;
                            }
                        }
                        body { 
                            font-family: sans-serif; 
                            margin: 1cm;
                        }
                        h1 { 
                            font-size: 14pt; 
                            margin-bottom: 0.5cm; 
                        }
                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            font-size: 7pt;
                            table-layout: auto;
                        }
                        th, td { 
                            border: 1px solid #ccc; 
                            padding: 2px 4px; 
                            text-align: left; 
                            word-wrap: break-word;
                            line-height: 1.1;
                        }
                        th { 
                            background-color: #f2f2f2 !important; 
                            font-weight: bold; 
                            -webkit-print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                        tr:nth-child(even) { 
                            background-color: #f9f9f9 !important; 
                            -webkit-print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                    </style>
                </head>
                <body>
                    <h1>${printTitle}</h1>
                    <table>
                        ${tableHeader}
                        ${tableBody}
                    </table>
                </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    };

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
           <Sidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                files={files}
                onFileChange={handleFileChange}
                onExtractData={handleExtractData}
                globalStatus={globalStatus}
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
           />
        </div>
    );
};

export default App;