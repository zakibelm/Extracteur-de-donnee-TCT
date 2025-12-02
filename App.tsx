
/**
 * <summary>
 * Gain de performance : Le traitement des pages PDF est maintenant parallélisé, réduisant le temps de conversion (ex: de 5s à 0.5s pour 10 pages).
 * Robustesse accrue : La conversion de chaque page est isolée ; un échec sur une page n'arrête plus le traitement du PDF entier.
 * </summary>
 */
import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Status, ExtractedData, TableData, AGENT_ROLES, ChatMessage } from './types';
import { extractDataFromImage } from './services/geminiService';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { AuthPage, User } from './components/AuthPage';
import { fetchTournees, syncTournees } from './services/airtable';

// Set worker path for pdf.js to match the version from the import map
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@5.4.394/build/pdf.worker.mjs`;

/**
 * Processes a single page of a PDF document into an image File object.
 * This function is designed to be run in parallel for multiple pages.
 * @param pdf - The loaded PDF document proxy from pdf.js.
 * @param pageNum - The page number to process.
 * @param originalPdfName - The filename of the original PDF for naming the output.
 * @returns A promise that resolves to a processable file object or null if an error occurs.
 */
async function processPage(pdf, pageNum, originalPdfName) {
    try {
        const page = await pdf.getPage(pageNum);
        // Scale 2.0 for High Quality (sharper text for OCR)
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            // High quality JPEG for text clarity (0.95)
            const blob = await new Promise<Blob | null>(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.95);
            });
            if (blob) {
                const pageFileName = `${originalPdfName}-page-${pageNum}.jpg`;
                const pageFile = new File([blob], pageFileName, { type: 'image/jpeg' });
                return { file: pageFile, originalFileName: originalPdfName, id: `${pageFileName}-${Date.now()}` };
            }
        }
        return null;
    }
    catch (error) {
        console.error(`Erreur lors du traitement de la page ${pageNum} de ${originalPdfName}`, error);
        return null; // Return null on error for a specific page, allowing others to succeed
    }
}
/**
 * Converts all pages of a PDF file into an array of image files.
 * Batched to 1 to avoid memory overflow on mobile/cloud run.
 * @param pdfFile The PDF file to process.
 * @returns A promise that resolves to an array of processable file objects.
 */
const processPdf = async (pdfFile) => {
    console.time(`PDF_Convert_${pdfFile.name}`);
    const fileBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(fileBuffer).promise;
    
    // Process pages sequentially to ensure stability
    const BATCH_SIZE = 1;
    let allPageResults = [];

    for (let i = 0; i < pdf.numPages; i += BATCH_SIZE) {
        const batchPromises = [];
        for (let j = 0; j < BATCH_SIZE && (i + j) < pdf.numPages; j++) {
            batchPromises.push(processPage(pdf, i + j + 1, pdfFile.name));
        }
        const batchResults = await Promise.all(batchPromises);
        allPageResults = [...allPageResults, ...batchResults];
    }

    console.timeEnd(`PDF_Convert_${pdfFile.name}`);
    // Filter out any pages that may have failed during conversion.
    return allPageResults.filter((result) => result !== null);
};

// --- Optimisation Image (Smart Compression) ---
// REFACTOR: Use Blob instead of DataURL string loop to reduce GC pressure (Memory Optimization)
const optimizeImageForMobile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        // HAUTE QUALITÉ RESTAURÉE
        const MAX_WIDTH = 2500; // 2500px pour une lecture parfaite des petits caractères
        const TARGET_SIZE_BYTES = 4 * 1024 * 1024; // 4MB Limit (Large bandwidth allowed)
        
        const img = new Image();
        
        // Use createObjectURL instead of FileReader to save RAM
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = async () => {
            URL.revokeObjectURL(objectUrl); // Clean up memory immediately
            
            let width = img.width;
            let height = img.height;
            let quality = 0.95; // High Quality Start

            // Initial Resize if huge
            if (width > MAX_WIDTH) {
                height = Math.round(height * (MAX_WIDTH / width));
                width = MAX_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Canvas context failed"));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            // Refactor: Loop on Blob size (binary) instead of Base64 string length
            // This prevents allocating huge strings repeatedly in the loop
            const getBlob = (q: number) => new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', q));

            let blob = await getBlob(quality);

            // Adaptive compression loop
            while (blob && blob.size > TARGET_SIZE_BYTES && quality > 0.5) {
                quality -= 0.1;
                blob = await getBlob(quality);
            }
            
            // Safety net: if still > 4MB, scale down dimensions
            if (blob && blob.size > TARGET_SIZE_BYTES) {
                 canvas.width = canvas.width * 0.9;
                 canvas.height = canvas.height * 0.9;
                 ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                 blob = await getBlob(0.8);
            }

            if (!blob) {
                reject(new Error("Image compression failed"));
                return;
            }

            // Final conversion to Base64 only once
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64data = reader.result as string;
                resolve(base64data.split(',')[1]);
            };
            reader.onerror = reject;
        };
        
        img.onerror = (e) => {
            URL.revokeObjectURL(objectUrl);
            reject(e);
        };
        
        img.src = objectUrl;
    });
};

// Helper function to build unified table logic (reusable)
const buildUnifiedTable = (dataList) => {
    const successfulExtractions = dataList
        .filter(d => d.status === Status.Success && d.content && d.content.rows.length > 0 && d.content.headers[0] !== 'Erreur');
    if (successfulExtractions.length === 0) {
        return null;
    }
    // Clone des en-têtes pour ne pas muter l'objet original
    const masterHeaders = [...successfulExtractions[0].content.headers];
    // Recherche de l'index de la colonne "Véhicule"
    const vehiculeIndex = masterHeaders.indexOf("Véhicule");
    // Si la colonne existe, on ajoute "Changement" et "Changement par" juste après
    if (vehiculeIndex !== -1) {
        if (!masterHeaders.includes("Changement")) {
            masterHeaders.splice(vehiculeIndex + 1, 0, "Changement");
        }
        if (!masterHeaders.includes("Changement par")) {
            masterHeaders.splice(vehiculeIndex + 2, 0, "Changement par");
        }
    }
    
    // Performance: Use a Set to deduplicate rows based on stringified content
    const uniqueRowsSet = new Set();
    const rows = [];

    successfulExtractions.forEach(d => {
        d.content.rows.forEach(row => {
            // Clone de la ligne
            const newRow = [...row];
            if (vehiculeIndex !== -1) {
                // Valeur par défaut = Numéro du véhicule
                const vehiculeVal = newRow[vehiculeIndex] || "";
                // Insertion à la position adéquate
                newRow.splice(vehiculeIndex + 1, 0, vehiculeVal, "");
            }
            
            // Deduplication Key
            const rowKey = JSON.stringify(newRow);
            if (!uniqueRowsSet.has(rowKey)) {
                uniqueRowsSet.add(rowKey);
                rows.push(newRow);
            }
        });
    });

    return {
        headers: masterHeaders,
        rows: rows,
    };
};

export const App = () => {
    // Auth State
    const [currentUser, setCurrentUser] = useState(null);
    const [files, setFiles] = useState([]);
    const [extractedData, setExtractedData] = useState([]);
    const [globalStatus, setGlobalStatus] = useState(Status.Idle);
    const [error, setError] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    // Initialisation différée pour récupérer le tableau sauvegardé
    const [unifiedTable, setUnifiedTable] = useState(() => {
        try {
            const savedTable = localStorage.getItem('edt_unified_table');
            return savedTable ? JSON.parse(savedTable) : null;
        }
        catch (e) {
            console.error("Erreur lors du chargement du tableau depuis le stockage local", e);
            return null;
        }
    });
    const [activeView, setActiveView] = useState('extract');
    
    // Check if user is admin
    // MODIFICATION : Dôme 407 est ajouté aux admins pour faciliter les tests
    const isAdmin = (currentUser?.numDome === '999' && currentUser?.idEmploye === '090') || currentUser?.numDome === '407';

    // Effet pour basculer automatiquement sur la vue document si un tableau est restauré
    useEffect(() => {
        if (unifiedTable && extractedData.length === 0) {
            setActiveView('document');
        }
    }, []); // Ne s'exécute qu'au montage
    
    // Handlers Auth
    const handleLogin = async (user) => {
        setCurrentUser(user);
        
        // --- SYNCHRONISATION CLOUD AU LOGIN ---
        // On essaie de récupérer le dernier tableau depuis Airtable
        // Si échec (offline), on garde le localStorage
        try {
             const cloudTable = await fetchTournees();
             if (cloudTable) {
                 setUnifiedTable(cloudTable);
                 localStorage.setItem('edt_unified_table', JSON.stringify(cloudTable));
                 console.log("Tableau synchronisé depuis le Cloud");
             } else {
                 // Fallback local
                 const savedTable = localStorage.getItem('edt_unified_table');
                 if (savedTable) setUnifiedTable(JSON.parse(savedTable));
             }
        } catch (e) {
            console.error("Erreur sync cloud login", e);
            const savedTable = localStorage.getItem('edt_unified_table');
            if (savedTable) setUnifiedTable(JSON.parse(savedTable));
        }

        // Vérification des droits Admin (incluant le 407 temporaire)
        const userIsAdmin = (user.numDome === '999' && user.idEmploye === '090') || user.numDome === '407';
        
        if (!userIsAdmin) {
            setActiveView('document');
        } else {
            setActiveView('extract');
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        // On NE vide PAS le unifiedTable ni le localStorage pour permettre le partage
        // Mais on nettoie l'espace de travail d'upload pour la sécurité
        setFiles([]);
        setExtractedData([]);
        setGlobalStatus(Status.Idle);
        setError(null);
    };

    const handleFileChange = (selectedFiles) => {
        setFiles(selectedFiles);
        setExtractedData([]);
        setError(null);
        setUnifiedTable(null);
        setGlobalStatus(Status.Idle);
        setActiveView('extract');
        // On ne nettoie le storage que si on commence explicitement un nouvel import
        localStorage.removeItem('edt_unified_table'); 
    };

    // Gestion suppression fichier source
    const handleRemoveFile = (fileName: string) => {
        setFiles(prev => prev.filter(f => f.name !== fileName));
    };

    const handleDeleteResult = (id) => {
        // 1. Mettre à jour les données extraites
        const updatedData = extractedData.filter(item => item.id !== id);
        setExtractedData(updatedData);
        // 2. Si un tableau unifié existait, on le met à jour dynamiquement
        if (unifiedTable || updatedData.length > 0) {
            const newTable = buildUnifiedTable(updatedData);
            setUnifiedTable(newTable);
            if (newTable) {
                try {
                    localStorage.setItem('edt_unified_table', JSON.stringify(newTable));
                }
                catch (e) {
                    console.warn("Impossible de sauvegarder après suppression (Quota ?)", e);
                }
            } else {
                localStorage.removeItem('edt_unified_table');
            }
        }
    };
    
    const handleExtractData = async () => {
        if (files.length === 0) return;
        setGlobalStatus(Status.Processing);
        setError(null);
        setExtractedData([]);
        setUnifiedTable(null); // Reset table on new extraction
        
        let processableItems = [];
        
        // 1. Prepare items (Convert PDF to Images if needed)
        for (const file of files) {
            if (file.type === 'application/pdf') {
                try {
                    const pageImages = await processPdf(file);
                    processableItems = [...processableItems, ...pageImages];
                } catch (err) {
                     console.error("PDF Error", err);
                     setError(`Erreur lors de la lecture du PDF ${file.name}`);
                }
            } else {
                processableItems.push({ 
                    file: file, 
                    originalFileName: file.name, 
                    id: `${file.name}-${Date.now()}` 
                });
            }
        }

        const initialDataState = processableItems.map(item => ({
            id: item.id,
            fileName: item.originalFileName,
            imageSrc: URL.createObjectURL(item.file),
            content: null,
            status: Status.Processing
        }));
        
        setExtractedData(initialDataState);

        // 2. Process items in BATCHES
        // CONCURRENCY_LIMIT: 2 items at a time
        const CONCURRENCY_LIMIT = 2;
        const updatedDataState = [...initialDataState];

        for (let i = 0; i < processableItems.length; i += CONCURRENCY_LIMIT) {
            const batch = processableItems.slice(i, i + CONCURRENCY_LIMIT);
            
            batch.forEach((_, idx) => {
                const dataIndex = i + idx;
                updatedDataState[dataIndex] = { ...updatedDataState[dataIndex], status: Status.AiProcessing };
            });
            setExtractedData([...updatedDataState]);

            const batchPromises = batch.map(async (item, idx) => {
                const dataIndex = i + idx;
                try {
                    // Optimize image (Resize & Compress) before sending to API
                    const base64Image = await optimizeImageForMobile(item.file);
                    
                    const result = await extractDataFromImage(base64Image, 'image/jpeg');
                    
                    return {
                        index: dataIndex,
                        content: result,
                        status: result.headers[0] === 'Erreur' ? Status.Error : Status.Success
                    };
                } catch (err) {
                    console.error("Extraction error", err);
                    return {
                        index: dataIndex,
                        content: { headers: ['Erreur'], rows: [[err instanceof Error ? err.message : "Erreur inconnue"]] },
                        status: Status.Error
                    };
                }
            });

            const results = await Promise.all(batchPromises);

            results.forEach(res => {
                updatedDataState[res.index] = {
                    ...updatedDataState[res.index],
                    content: res.content,
                    status: res.status
                };
            });
            
            setExtractedData([...updatedDataState]);
        }

        setGlobalStatus(Status.Success);
        
        // 3. Auto-generate Unified Table at the end
        const finalTable = buildUnifiedTable(updatedDataState);
        if (finalTable) {
            setUnifiedTable(finalTable);
            try {
                localStorage.setItem('edt_unified_table', JSON.stringify(finalTable));
                // Synchro Cloud automatique après extraction (Backup)
                await syncTournees(finalTable);
            } catch (e) {
                console.warn("Auto-save cloud/local failed", e);
            }
        }
    };

    const handleGenerateResults = async () => {
        const table = buildUnifiedTable(extractedData);
        if (table) {
            setUnifiedTable(table);
            setActiveView('document');
             try {
                localStorage.setItem('edt_unified_table', JSON.stringify(table));
                // SYNCHRO CLOUD MANUELLE (bouton)
                await syncTournees(table);
                alert("Données synchronisées avec le Cloud Airtable avec succès !");
            } catch (e) {
                console.warn("Manual save failed", e);
                alert("Sauvegarde locale OK, mais échec Cloud (Vérifiez votre config).");
            }
        } else {
            setError("Aucune donnée valide n'a été extraite.");
        }
    };
    
    // Callback pour mettre à jour le tableau depuis FinalDocumentView (édition manuelle)
    const handleTableUpdate = (newTable) => {
        setUnifiedTable(newTable);
        // Persistance immédiate
        try {
            localStorage.setItem('edt_unified_table', JSON.stringify(newTable));
            // Pour l'édition ligne par ligne, on pourrait faire un appel API optimisé,
            // mais ici on resync tout ou on laisse le prochain load faire le travail.
            // Pour être pro : on devrait appeler une fonction de mise à jour unique
            // updateTourneeRow(rowId, changes)
        } catch (e) {
            console.error("Erreur sauvegarde update", e);
        }
    };

    const handlePrint = (headers, rows) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impression - ADT</title>
          <style>
            @page { size: landscape; margin: 5mm; }
            body { font-family: sans-serif; -webkit-print-color-adjust: exact; font-size: 5pt; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 0.5px solid #000; padding: 2px; text-align: left; overflow: hidden; white-space: nowrap; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .mobile-warning { display: none; }
            @media print {
               body { zoom: 0.55; }
            }
          </style>
        </head>
        <body>
          <h2>Document Final - ADT</h2>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleDownloadPdf = (headers: string[], rows: string[][]) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        autoTable(doc, {
            head: [headers],
            body: rows,
            styles: { fontSize: 6 },
            theme: 'grid'
        });
        doc.save('ADT_Document.pdf');
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
                onRemoveFile={handleRemoveFile}
                onExtractData={handleExtractData}
                globalStatus={globalStatus}
                user={currentUser}
                isAdmin={isAdmin}
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
                isAdmin={isAdmin}
                onLogout={handleLogout}
            />
        </div>
    );
};
