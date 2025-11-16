
import React, { useState, useCallback, useRef, useLayoutEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { ExtractedData, Status, TableData, SummaryData } from './types';
import { extractDataFromImage } from './services/geminiService';
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { gsap } from 'gsap';
pdfMake.vfs = pdfFonts.vfs;


// Set worker path for pdf.js to match the version from the import map
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@5.4.394/build/pdf.worker.mjs`;

interface ProcessableFile {
    id: string;
    file: File;
    originalFileName: string;
    base64: string;
    mimeType: string;
}

const App: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [globalStatus, setGlobalStatus] = useState<Status>(Status.Idle);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [unifiedTable, setUnifiedTable] = useState<TableData | null>(null);
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

    const [activeView, setActiveView] = useState<'extract' | 'results'>('extract');
    
    const container = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(container.current, {
                opacity: 0,
                duration: 0.8,
                ease: 'power3.out'
            });
        });
        return () => ctx.revert();
    }, []);

    const handleFileChange = (selectedFiles: File[]) => {
        setFiles(selectedFiles);
        setExtractedData([]);
        setError(null);
        setUnifiedTable(null);
        setSummaryData(null);
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

    const processPdf = async (pdfFile: File): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'>[]> => {
        const fileBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(fileBuffer).promise;
        const pageFiles: Omit<ProcessableFile, 'base64' | 'mimeType'>[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
                if (blob) {
                    const pageFileName = `${pdfFile.name}-page-${i}.jpg`;
                    const pageFile = new File([blob], pageFileName, { type: 'image/jpeg' });
                    pageFiles.push({ file: pageFile, originalFileName: pdfFile.name, id: `${pageFileName}-${Date.now()}` });
                }
            }
        }
        return pageFiles;
    };

    const handleExtractData = useCallback(async () => {
        if (files.length === 0) {
            setError("Veuillez sélectionner au moins un fichier.");
            return;
        }

        setGlobalStatus(Status.Processing);
        setError(null);
        setUnifiedTable(null);
        setSummaryData(null);
        setActiveView('extract');

        try {
            const processableFiles: ProcessableFile[] = [];
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
        
        const nomEmployeIndex = masterHeaders.indexOf("Nom de l'employé");
        const vehiculeIndex = masterHeaders.indexOf("Véhicule");
        const adresseDebutIndex = masterHeaders.indexOf("Adresse de début");
        const adresseFinIndex = masterHeaders.indexOf("Adresse de fin");

        const summary: SummaryData = {
            totalRows: finalTable.rows.length,
            uniqueChauffeurs: [...new Set(finalTable.rows.map(r => r[nomEmployeIndex]).filter(Boolean))],
            uniqueVehicules: [...new Set(finalTable.rows.map(r => r[vehiculeIndex]).filter(Boolean))],
            uniqueAdressesDepart: [...new Set(finalTable.rows.map(r => r[adresseDebutIndex]).filter(Boolean))],
            uniqueAdressesArrivee: [...new Set(finalTable.rows.map(r => r[adresseFinIndex]).filter(Boolean))],
        };
        setSummaryData(summary);
        setActiveView('results');
    };
    
    const handleDownloadPdf = (headers: string[], rows: string[][]) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedDate = tomorrow.toISOString().split('T')[0];
        const printTitle = `${formattedDate}_TCT_Filtre`;

        const docDefinition = {
            pageSize: 'A4',
            pageOrientation: 'landscape',
            pageMargins: [20, 20, 20, 20],
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
                header: { fontSize: 14, bold: true, margin: [0, 0, 0, 10] },
                tableExample: { margin: [0, 5, 0, 15], fontSize: 7 },
                tableHeader: { bold: true, fontSize: 8, color: 'black' }
            }
        };

        pdfMake.createPdf(docDefinition).download(`${printTitle}.pdf`);
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
        <div ref={container} className="flex h-screen bg-transparent text-[--color-foreground] font-sans">
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
                unifiedTableIsReady={!!unifiedTable}
                unifiedTable={unifiedTable}
                onPrint={handlePrint}
                onDownloadPdf={handleDownloadPdf}
           />
        </div>
    );
};

export default App;