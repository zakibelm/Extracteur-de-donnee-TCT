/**
 * <summary>
 * Gain de performance : Le traitement des pages PDF est maintenant parallélisé, réduisant le temps de conversion (ex: de 5s à 0.5s pour 10 pages).
 * Robustesse accrue : La conversion de chaque page est isolée ; un échec sur une page n'arrête plus le traitement du PDF entier.
 * </summary>
 */
import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Status, ExtractedData, TableData, AGENT_ROLES, ChatMessage } from './types';
import { extractDataFromImage } from './services/geminiService';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { AuthPage, User } from './components/AuthPage';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
        // High Quality Scale for OCR (2.0 = ~200-300 DPI depending on source)
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            // High quality JPEG for text clarity
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
 * Converts all pages of a PDF file into an array of image files in parallel.
 * Batched to avoid memory overflow on mobile.
 * @param pdfFile The PDF file to process.
 * @returns A promise that resolves to an array of processable file objects.
 */
const processPdf = async (pdfFile) => {
    console.time(`PDF_Convert_${pdfFile.name}`);
    const fileBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(fileBuffer).promise;
    
    // Process pages in batches of 3 to avoid memory crash on mobile
    const BATCH_SIZE = 3;
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
// Réduit seulement si l'image est excessivement lourde (> 4Mo) pour préserver la qualité OCR
const optimizeImageForMobile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const MAX_WIDTH = 2500; // High resolution for clear text reading
        const TARGET_SIZE_BYTES = 4 * 1024 * 1024; // 4MB Limit (Safe for network, high quality for AI)
        const img = new Image();
        
        // Use createObjectURL instead of FileReader to save RAM
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(objectUrl); // Clean up memory immediately
            
            let width = img.width;
            let height = img.height;
            let quality = 0.95; // Start with high quality

            // Resize logic only if dimensions are massive
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

            // Adaptive compression loop
            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            
            // Only compress if absolutely necessary (e.g. > 4MB)
            while (dataUrl.length > TARGET_SIZE_BYTES && quality > 0.5) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            
            // Safety net: if still huge, scale down dimensions
            while (dataUrl.length > TARGET_SIZE_BYTES) {
                 canvas.width = canvas.width * 0.8;
                 canvas.height = canvas.height * 0.8;
                 ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                 dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            }

            resolve(dataUrl.split(',')[1]); // Return clean Base64
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
    let allRows = successfulExtractions.flatMap(d => {
        return d.content.rows.map(row => {
            // Clone de la ligne
            const newRow = [...row];
            if (vehiculeIndex !== -1) {
                // Valeur par défaut = Numéro du véhicule
                const vehiculeVal = newRow[vehiculeIndex] || "";
                // Insertion à la position adéquate (on insère deux colonnes vides)
                // Note: on insère d'abord "Changement par" (index+2) puis "Changement" (index+1) 
                // ou on fait splice une fois avec les deux éléments.
                // Ici on insère la valeur du véhicule dans "Changement" pour initialiser, et vide pour "Changement par".
                newRow.splice(vehiculeIndex + 1, 0, vehiculeVal, "");
            }
            return newRow;
        });
    });
    const uniqueRows = Array.from(new Set(allRows.map(row => JSON.stringify(row))))
        .map((str: string) => JSON.parse(str));
    return {
        headers: masterHeaders,
        rows: uniqueRows,
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
    const isAdmin = currentUser?.numDome === '999' && currentUser?.idEmploye === '090';

    // Effet pour basculer automatiquement sur la vue document si un tableau est restauré
    useEffect(() => {
        if (unifiedTable && extractedData.length === 0) {
            setActiveView('document');
        }
    }, []); // Ne s'exécute qu'au montage
    
    // Handlers Auth
    const handleLogin = (user) => {
        setCurrentUser(user);
        
        // Sécurité : Recharger le tableau depuis le localStorage si disponible
        try {
             const savedTable = localStorage.getItem('edt_unified_table');
             if (savedTable) {
                 setUnifiedTable(JSON.parse(savedTable));
             }
        } catch (e) {
            console.error("Erreur rechargement table login", e);
        }

        // Redirection auto selon le rôle
        const userIsAdmin = user.numDome === '999' && user.idEmploye === '090';
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
        // Cela permet de garder la cohérence sans avoir à recliquer sur "Générer"
        if (unifiedTable || updatedData.length > 0) {
            const newTable = buildUnifiedTable(updatedData);
            setUnifiedTable(newTable); // Peut être null si tout est supprimé, c'est ok
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
    
    // --- Fonction de Sauvegarde Manuelle (Backup) ---
    const handleBackupSession = () => {
        if (!unifiedTable) {
             alert("Aucune donnée à sauvegarder.");
             return;
        }
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(unifiedTable));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            const date = new Date().toISOString().slice(0, 10);
            downloadAnchorNode.setAttribute("download", `ADT_Session_${date}.json`);
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } catch (e) {
            console.error("Backup failed", e);
            alert("Erreur lors de la création de la sauvegarde.");
        }
    };

    // --- Fonction de Restauration Manuelle ---
    const handleRestoreSession = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = event.target?.result as string;
                const parsed = JSON.parse(json);
                if (parsed && Array.isArray(parsed.headers) && Array.isArray(parsed.rows)) {
                    setUnifiedTable(parsed);
                    localStorage.setItem('edt_unified_table', JSON.stringify(parsed));
                    setActiveView('document');
                    alert("Session restaurée avec succès !");
                } else {
                    alert("Format de fichier invalide.");
                }
            } catch (err) {
                console.error("Restore failed", err);
                alert("Impossible de lire le fichier de sauvegarde.");
            }
            // Reset input
            e.target.value = '';
        };
        reader.readAsText(file);
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

        // Initialize state placeholders
        const initialDataState = processableItems.map(item => ({
            id: item.id,
            fileName: item.originalFileName,
            imageSrc: URL.createObjectURL(item.file), // Use ObjectURL for preview
            content: null,
            status: Status.Processing
        }));
        
        setExtractedData(initialDataState);

        // 2. Process items in BATCHES (Parallel Processing)
        // CONCURRENCY_LIMIT: 3 items at a time to balance speed and stability
        const CONCURRENCY_LIMIT = 3;
        const updatedDataState = [...initialDataState];

        for (let i = 0; i < processableItems.length; i += CONCURRENCY_LIMIT) {
            const batch = processableItems.slice(i, i + CONCURRENCY_LIMIT);
            
            // Mark current batch as "AI Processing"
            batch.forEach((_, idx) => {
                const dataIndex = i + idx;
                updatedDataState[dataIndex] = { ...updatedDataState[dataIndex], status: Status.AiProcessing };
            });
            setExtractedData([...updatedDataState]);

            // Execute batch in parallel
            const batchPromises = batch.map(async (item, idx) => {
                const dataIndex = i + idx;
                try {
                    // Optimize image (Resize & Compress) before sending to API
                    // High Quality Mode maintained
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

            // Wait for all items in this batch
            const results = await Promise.all(batchPromises);

            // Update state with results from this batch
            results.forEach(res => {
                updatedDataState[res.index] = {
                    ...updatedDataState[res.index],
                    content: res.content,
                    status: res.status
                };
            });
            
            // Update UI after batch completion
            setExtractedData([...updatedDataState]);
        }

        setGlobalStatus(Status.Success);
        
        // 3. Auto-generate Unified Table at the end
        const finalTable = buildUnifiedTable(updatedDataState);
        if (finalTable) {
            setUnifiedTable(finalTable);
            try {
                localStorage.setItem('edt_unified_table', JSON.stringify(finalTable));
            } catch (e) {
                console.warn("Auto-save failed", e);
            }
        }
    };

    const handleGenerateResults = () => {
        const table = buildUnifiedTable(extractedData);
        if (table) {
            setUnifiedTable(table);
            setActiveView('document');
             try {
                localStorage.setItem('edt_unified_table', JSON.stringify(table));
            } catch (e) {
                console.warn("Manual save failed", e);
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
    const handleDownloadPdf = (headers, rows) => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFontSize(8);
        doc.text("Document Final - ADT", 14, 10);
        // @ts-ignore
        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 15,
            styles: { fontSize: 5, cellPadding: 1, overflow: 'ellipsize' },
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        });
        doc.save(`ADT_Document_${new Date().toISOString().slice(0, 10)}.pdf`);
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
                // onLogout removed from Sidebar, moved to MainContent header
                isAdmin={isAdmin}
                onBackup={handleBackupSession}
                onRestore={handleRestoreSession}
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