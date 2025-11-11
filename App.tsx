import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
import { FileUploader } from './components/FileUploader';
import { ResultCard } from './components/ResultCard';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { Icons } from './components/Icons';
import { ExtractedData, Status, TableData, SummaryData } from './types';
import { extractTextFromImage } from './services/geminiService';

// Set worker path for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.mjs`;

// Add type declarations for Tesseract.js
declare const Tesseract: {
    createWorker: (lang?: string, oem?: number, options?: any) => Promise<Tesseract.Worker>;
};
declare namespace Tesseract {
    interface Worker {
        recognize: (image: File) => Promise<RecognizeResult>;
        terminate: () => void;
    }
    interface RecognizeResult {
        data: {
            text: string;
        };
    }
}

interface ProcessableFile {
    file: File;
    originalFileName: string;
}

const App: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [globalStatus, setGlobalStatus] = useState<Status>(Status.Idle);
    const [error, setError] = useState<string | null>(null);
    const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
    
    const [unifiedTable, setUnifiedTable] = useState<TableData | null>(null);
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);


    const handleFileChange = (selectedFiles: File[]) => {
        setFiles(selectedFiles);
        setExtractedData([]);
        setError(null);
        setGlobalStatus(Status.Idle);
    };

    const fileToGenerativePart = async (file: File) => {
        const base64EncodedDataPromise = new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });
        return {
            inlineData: {
                data: await base64EncodedDataPromise,
                mimeType: file.type,
            },
        };
    };

    const processPdf = async (pdfFile: File): Promise<ProcessableFile[]> => {
        const fileBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(fileBuffer).promise;
        const pageFiles: ProcessableFile[] = [];

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
                    const pageFile = new File([blob], `${pdfFile.name}-page-${i}.jpg`, { type: 'image/jpeg' });
                    pageFiles.push({ file: pageFile, originalFileName: pdfFile.name });
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

        // Flatten PDF pages into processable files
        const processableFiles: ProcessableFile[] = [];
        for (const file of files) {
            if (file.type === 'application/pdf') {
                try {
                    const pdfPages = await processPdf(file);
                    processableFiles.push(...pdfPages);
                } catch (pdfError) {
                    console.error(`Erreur lors du traitement du PDF ${file.name}:`, pdfError);
                    setError(`Impossible de traiter le fichier PDF: ${file.name}.`);
                    setGlobalStatus(Status.Error);
                    return;
                }
            } else {
                processableFiles.push({ file, originalFileName: file.name });
            }
        }
        
        const initialData: ExtractedData[] = processableFiles.map(({ file, originalFileName }, index) => {
            const pageNumber = file.name.match(/-page-(\d+)\.jpg$/);
            const displayName = originalFileName.endsWith('.pdf') && pageNumber 
                ? `${originalFileName} (Page ${pageNumber[1]})` 
                : originalFileName;

            return {
                id: `${file.name}-${index}`,
                fileName: displayName,
                imageSrc: URL.createObjectURL(file),
                content: null,
                status: Status.OcrProcessing,
            };
        });
        setExtractedData(initialData);

        let workers: Tesseract.Worker[] = [];
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            // --- OPTIMIZATION: Create a pool of Tesseract workers ---
            const workerCount = navigator.hardwareConcurrency || 4; // Use available cores, fallback to 4
            workers = await Promise.all(
                Array.from({ length: workerCount }, () => Tesseract.createWorker('fra'))
            );

            const promises = processableFiles.map(async ({ file }, index) => {
                const worker = workers[index % workerCount]; // Distribute files among workers
                const fileId = `${file.name}-${index}`;
                
                try {
                    // 1. OCR Step (now in parallel)
                    setExtractedData(prev => prev.map(item => item.id === fileId ? { ...item, status: Status.OcrProcessing } : item));
                    const ocrResult = await worker.recognize(file);
                    const ocrText = ocrResult.data.text;

                    // 2. AI Step (already in parallel)
                    setExtractedData(prev => prev.map(item => item.id === fileId ? { ...item, status: Status.AiProcessing } : item));
                    const imagePart = await fileToGenerativePart(file);
                    const content = await extractTextFromImage(ai, imagePart, ocrText);

                    setExtractedData(prev =>
                        prev.map(item =>
                            item.id === fileId ? { ...item, content, status: Status.Success } : item
                        )
                    );
                } catch (err) {
                    console.error(`Erreur lors du traitement du fichier ${file.name}:`, err);
                    const errorMessage = err instanceof Error ? err.message : "Échec de l'extraction.";
                    setExtractedData(prev =>
                        prev.map(item =>
                            item.id === fileId ? { ...item, content: { headers: [], rows: [[errorMessage]]}, status: Status.Error } : item
                        )
                    );
                }
            });

            await Promise.all(promises);
            setGlobalStatus(Status.Success);
        } catch (e) {
            console.error("Erreur lors de l'initialisation des services:", e);
            setError("Impossible d'initialiser les services d'extraction. Vérifiez votre clé API et la console.");
            setGlobalStatus(Status.Error);
            setExtractedData(prev => prev.map(item => ({ ...item, status: Status.Error })));
        } finally {
            // --- OPTIMIZATION: Terminate all workers in the pool ---
            if (workers.length > 0) {
                await Promise.all(workers.map(w => w.terminate()));
            }
        }
    }, [files]);

    const handleGenerateResults = () => {
        const successfulExtractions = extractedData
            .filter(d => d.status === Status.Success && d.content && d.content.rows.length > 0);

        if (successfulExtractions.length === 0) {
            setError("Aucune donnée valide à traiter.");
            return;
        }

        const masterHeaders = successfulExtractions[0].content!.headers;
        let allRows = successfulExtractions.flatMap(d => d.content!.rows);

        // Deduplicate rows
        // FIX: The argument to `JSON.parse` can be inferred as `unknown` in some TypeScript configurations, causing a type error. Casting `str` to `string` resolves this.
        const uniqueRows = Array.from(new Set(allRows.map(row => JSON.stringify(row))))
            .map(str => JSON.parse(str as string) as string[]);
            
        const finalTable: TableData = {
            headers: masterHeaders,
            rows: uniqueRows,
        };
        setUnifiedTable(finalTable);
        
        // Generate Summary
        const nomChauffeurIndex = masterHeaders.indexOf("Nom chauffeur");
        const numeroVehiculeIndex = masterHeaders.indexOf("Numéro véhicule");
        const adresseDepartIndex = masterHeaders.indexOf("Adresse départ");
        const adresseArriveeIndex = masterHeaders.indexOf("Adresse arrivée");

        const summary: SummaryData = {
            totalRows: finalTable.rows.length,
            uniqueChauffeurs: [...new Set(finalTable.rows.map(r => r[nomChauffeurIndex]).filter(Boolean))],
            uniqueVehicules: [...new Set(finalTable.rows.map(r => r[numeroVehiculeIndex]).filter(Boolean))],
            uniqueAdressesDepart: [...new Set(finalTable.rows.map(r => r[adresseDepartIndex]).filter(Boolean))],
            uniqueAdressesArrivee: [...new Set(finalTable.rows.map(r => r[adresseArriveeIndex]).filter(Boolean))],
        };
        setSummaryData(summary);

        setIsResultsModalOpen(true);
    };

    const downloadFile = (format: 'csv' | 'json') => {
        if (!unifiedTable) return;

        const filename = `donnees_extraites.${format}`;
        let content = '';
        let mimeType = '';

        if (format === 'csv') {
            const header = unifiedTable.headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
            const body = unifiedTable.rows.map(row => 
                row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
            ).join('\n');
            content = `${header}\n${body}`;
            mimeType = 'text/csv;charset=utf-8;';
        } else { // json
            const data = unifiedTable.rows.map(row => 
                unifiedTable.headers.reduce((obj, header, index) => {
                    obj[header] = row[index];
                    return obj;
                }, {} as Record<string, string>)
            );
            content = JSON.stringify(data, null, 2);
            mimeType = 'application/json;charset=utf-8;';
        }

        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        if (!unifiedTable) return;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedDate = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format
        const printTitle = `${formattedDate}_TCT`;

        const tableHeader = `
            <thead>
                <tr>
                    ${unifiedTable.headers.map(header => `<th>${header}</th>`).join('')}
                </tr>
            </thead>
        `;
        const tableBody = `
            <tbody>
                ${unifiedTable.rows.map(row => `
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
                    <h1>Données Extraites - Tableau Unifié</h1>
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


    const allProcessed = extractedData.length > 0 && extractedData.every(d => d.status === Status.Success || d.status === Status.Error);
    const hasSuccessfulExtractions = extractedData.some(d => d.status === Status.Success && d.content && d.content.rows.length > 0);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <main className="container mx-auto p-4 md:p-8">
                <header className="text-center mb-8 md:mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Extracteur de Données Tabulaires
                    </h1>
                    <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
                        Téléchargez images ou PDFs, extrayez, nettoyez et fusionnez les données en un tableau unique.
                    </p>
                </header>

                <div className="max-w-4xl mx-auto bg-slate-800 rounded-2xl shadow-2xl shadow-slate-950/50 p-6 md:p-8 border border-slate-700">
                    <FileUploader onFileChange={handleFileChange} />

                    {files.length > 0 && (
                        <div className="mt-8 flex flex-col sm:flex-row gap-4">
                            <Button
                                onClick={handleExtractData}
                                disabled={globalStatus === Status.Processing}
                                className="w-full bg-emerald-600 hover:bg-emerald-700"
                            >
                                {globalStatus === Status.Processing ? (
                                    <>
                                        <Icons.Loader className="animate-spin mr-2" />
                                        Traitement en cours...
                                    </>
                                ) : (
                                    <>
                                        <Icons.Sparkles className="mr-2" />
                                        Lancer l'Extraction
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={handleGenerateResults}
                                disabled={!allProcessed || !hasSuccessfulExtractions}
                                className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
                            >
                                <Icons.Eye className="mr-2" />
                                Générer les Résultats
                            </Button>
                        </div>
                    )}

                    {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
                </div>

                {extractedData.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-2xl font-bold text-center mb-8 text-slate-300">Résultats de l'Extraction par Fichier</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {extractedData.map((data) => (
                                <ResultCard key={data.id} data={data} />
                            ))}
                        </div>
                    </div>
                )}
            </main>
            <footer className="text-center p-4 text-slate-500 text-sm">
                <p>Propulsé par Zakibelm</p>
            </footer>

            <Modal isOpen={isResultsModalOpen} onClose={() => setIsResultsModalOpen(false)} title="Résultats Unifiés et Export">
                <div className="flex flex-col h-[75vh]">
                    <div className="flex-grow overflow-hidden flex flex-col">
                      <h3 className="text-lg font-semibold text-slate-200 mb-2">Tableau Final Unifié</h3>
                      <div className="overflow-auto border border-slate-700 rounded-md flex-grow">
                          <table className="w-full text-left text-xs">
                              <thead className="sticky top-0 bg-slate-800/80 backdrop-blur-sm">
                                  <tr className="text-slate-300">
                                      {unifiedTable?.headers.map((header, index) => (
                                          <th key={index} className="p-2 font-semibold border-b border-slate-600">{header}</th>
                                      ))}
                                  </tr>
                              </thead>
                              <tbody>
                                  {unifiedTable?.rows.map((row, rowIndex) => (
                                      <tr key={rowIndex} className="border-t border-slate-700 even:bg-slate-700/30 hover:bg-slate-700/50">
                                          {row.map((cell, cellIndex) => (
                                              <td key={cellIndex} className="p-2 text-slate-300">{cell}</td>
                                          ))}
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                       <h3 className="text-lg font-semibold text-slate-200 mt-4 mb-2">Résumé</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="bg-slate-700/50 p-3 rounded-md">
                                <div className="font-bold text-slate-400">Lignes Uniques</div>
                                <div className="text-2xl font-bold text-emerald-400">{summaryData?.totalRows ?? 0}</div>
                            </div>
                            <div className="bg-slate-700/50 p-3 rounded-md">
                                <div className="font-bold text-slate-400">Chauffeurs Uniques</div>
                                <div className="text-2xl font-bold text-sky-400">{summaryData?.uniqueChauffeurs.length ?? 0}</div>
                            </div>
                            <div className="bg-slate-700/50 p-3 rounded-md">
                                <div className="font-bold text-slate-400">Véhicules Uniques</div>
                                <div className="text-2xl font-bold text-sky-400">{summaryData?.uniqueVehicules.length ?? 0}</div>
                            </div>
                             <div className="bg-slate-700/50 p-3 rounded-md">
                                <div className="font-bold text-slate-400">Adresses Uniques</div>
                                <div className="text-2xl font-bold text-sky-400">{ new Set([...summaryData?.uniqueAdressesDepart ?? [], ...summaryData?.uniqueAdressesArrivee ?? []]).size }</div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col sm:flex-row justify-end gap-4">
                        <Button onClick={() => downloadFile('csv')} className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
                            <Icons.FileCsv className="mr-2" /> Exporter en CSV
                        </Button>
                        <Button onClick={() => downloadFile('json')} className="bg-sky-600 hover:bg-sky-700 w-full sm:w-auto">
                            <Icons.FileJson className="mr-2" /> Exporter en JSON
                        </Button>
                        <Button onClick={handlePrint} className="bg-slate-500 hover:bg-slate-600 w-full sm:w-auto">
                            <Icons.Print className="mr-2" /> Imprimer / PDF
                        </Button>
                         <Button onClick={() => setIsResultsModalOpen(false)} className="bg-slate-600 hover:bg-slate-700 w-full sm:w-auto order-first sm:order-last">
                            Fermer
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default App;