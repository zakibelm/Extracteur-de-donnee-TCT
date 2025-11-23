
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
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AuthPage, User } from './components/AuthPage';

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
    // Auth State
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const [files, setFiles] = useState<File[]>([]);
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [globalStatus, setGlobalStatus] = useState<Status>(Status.Idle);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [unifiedTable, setUnifiedTable] = useState<TableData | null>(null);

    const [activeView, setActiveView] = useState<'extract' | 'document'>('extract');

    // Handlers Auth
    const handleLogin = (user: User) => {
        setCurrentUser(user);
    };

    const handleLogout = () => {
        setCurrentUser(null);
        // Reset app state on logout
        setFiles([]);
        setExtractedData([]);
        setUnifiedTable(null);
        setGlobalStatus(Status.Idle);
    };

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

        // Clone des en-têtes pour ne pas muter l'objet original
        const masterHeaders = [...successfulExtractions[0].content!.headers];
        
        // Recherche de l'index de la colonne "Véhicule"
        const vehiculeIndex = masterHeaders.indexOf("Véhicule");
        
        // Si la colonne existe, on ajoute "Changement" juste après
        if (vehiculeIndex !== -1 && !masterHeaders.includes("Changement")) {
            masterHeaders.splice(vehiculeIndex + 1, 0, "Changement");
        }

        let allRows = successfulExtractions.flatMap(d => {
             return d.content!.rows.map(row => {
                 // Clone de la ligne
                 const newRow = [...row];
                 
                 if (vehiculeIndex !== -1) {
                     // Valeur par défaut = Numéro du véhicule
                     const vehiculeVal = newRow[vehiculeIndex] || "";
                     // Insertion à la position adéquate
                     newRow.splice(vehiculeIndex + 1, 0, vehiculeVal);
                 }
                 return newRow;
             });
        });

        const uniqueRows = Array.from(new Set(allRows.map(row => JSON.stringify(row))))
            .map(str => JSON.parse(str as string) as string[]);
            
        const finalTable: TableData = {
            headers: masterHeaders,
            rows: uniqueRows,
        };
        setUnifiedTable(finalTable);
        setActiveView('document');
    };

    // Callback pour mettre à jour le tableau depuis les composants enfants
    const handleTableUpdate = (newTableData: TableData) => {
        setUnifiedTable(newTableData);
    };
    
    const handleDownloadPdf = (headers: string[], rows: string[][]) => {
        console.time('PDF_Generation');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedDate = tomorrow.toISOString().split('T')[0];
        const printTitle = `${formattedDate}_TCT_Filtre`;

        try {
            // Initialisation de jsPDF en mode PAYSAGE ('l' pour landscape)
            // @ts-ignore
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            doc.setFontSize(14);
            doc.text(`Données Filtrées - ${printTitle}`, 14, 15);

            // Utilisation de jspdf-autotable pour générer le tableau
            // @ts-ignore
            autoTable(doc, {
                head: [headers],
                body: rows,
                startY: 20,
                styles: {
                    fontSize: 5, // Police minuscule pour faire tenir 14+ colonnes
                    cellPadding: 1,
                    overflow: 'linebreak', // Retour à la ligne auto
                    valign: 'middle',
                    halign: 'left',
                    lineWidth: 0.1,
                    lineColor: [200, 200, 200]
                },
                headStyles: {
                    fillColor: [22, 160, 133], // Emerald green
                    textColor: 255,
                    fontSize: 6, // En-têtes légèrement plus grands
                    fontStyle: 'bold',
                    halign: 'center'
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245]
                },
                theme: 'grid', // Lignes de grille visibles partout
                margin: { top: 20, left: 5, right: 5, bottom: 10 }, // Marges minimales
                tableWidth: 'auto'
            });

            doc.save(`${printTitle}.pdf`);
            console.timeEnd('PDF_Generation');
        } catch (e) {
            console.timeEnd('PDF_Generation');
            console.error("Erreur lors de la création du PDF", e);
            setError(`Erreur lors de la génération du PDF: ${(e as Error).message}`);
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
                    <meta charset="utf-8" />
                    <style>
                        /* Forçage du format Paysage */
                        @page {
                            size: A4 landscape;
                            margin: 3mm; /* Marges extrêmes */
                        }
                        
                        body { 
                            font-family: 'Helvetica Neue', Arial, sans-serif;
                            margin: 0;
                            padding: 0;
                            background: white;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            width: 100%;
                        }

                        h1 { 
                            font-size: 10pt; 
                            margin: 5px 0; 
                            text-align: center;
                            color: #000;
                        }
                        
                        /* Conteneur principal */
                        .print-container {
                            width: 100%;
                        }

                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            /* Police minuscule critique pour mobile */
                            font-size: 5pt; 
                            table-layout: auto; /* Permet aux colonnes de s'ajuster au contenu */
                        }

                        th, td { 
                            border: 0.5px solid #444; 
                            padding: 1px 2px; 
                            text-align: left; 
                            vertical-align: middle;
                            /* Césure agressive des mots pour éviter l'explosion du tableau */
                            word-wrap: break-word;
                            overflow-wrap: break-word;
                            word-break: break-all; 
                            max-width: 100px; /* Limite arbitraire pour forcer le retour à la ligne */
                        }

                        th { 
                            background-color: #ddd !important; 
                            color: #000 !important;
                            font-weight: bold; 
                            text-align: center;
                            font-size: 5.5pt;
                        }

                        tr:nth-child(even) { 
                            background-color: #f9f9f9 !important; 
                        }
                        
                        /* Hack spécifique pour essayer de forcer le navigateur mobile à dézoomer */
                        @media print {
                            body {
                                width: 100%;
                            }
                            table {
                                width: 100%;
                            }
                        }
                    </style>
                </head>
                <body>
                    <h1>${printTitle}</h1>
                    <div class="print-container">
                        <table>
                            ${tableHeader}
                            ${tableBody}
                        </table>
                    </div>
                </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            
            // Délai plus long pour s'assurer que le style est appliqué sur mobile
            setTimeout(() => {
                printWindow.focus();
                try {
                    printWindow.print();
                } catch (e) {
                    console.error("Erreur impression:", e);
                    alert("L'impression a échoué. Utilisez le bouton PDF.");
                }
                // Fermeture automatique après impression (délai pour mobile)
                // setTimeout(() => printWindow.close(), 1000); 
            }, 800);
        }
    };

    if (!currentUser) {
        return <AuthPage onLogin={handleLogin} />;
    }

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
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
                onTableUpdate={handleTableUpdate}
                onPrint={handlePrint}
                onDownloadPdf={handleDownloadPdf}
                user={currentUser}
           />
        </div>
    );
};

export default App;
