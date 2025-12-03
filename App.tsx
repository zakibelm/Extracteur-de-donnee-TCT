
/**
 * <summary>
 * Refactoring complet : La logique de traitement PDF, Image et Data a été déplacée dans des services dédiés (services/*.ts).
 * App.tsx est maintenant focalisé sur l'orchestration de l'état et l'UI.
 * </summary>
 */
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Status, ExtractedData, TableData } from './types';
import { extractDataFromImage } from './services/geminiService';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { AuthPage, User } from './components/AuthPage';
import { fetchTournees, syncTournees } from './services/airtable';

// Services importés (Refactoring)
import { processPdf } from './services/pdfProcessing';
import { optimizeImageForMobile } from './services/imageProcessing';
import { buildUnifiedTable } from './services/dataProcessing';

export const App = () => {
    // Auth State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [globalStatus, setGlobalStatus] = useState(Status.Idle);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    // Initialisation différée pour récupérer le tableau sauvegardé
    const [unifiedTable, setUnifiedTable] = useState<TableData | null>(() => {
        try {
            const savedTable = localStorage.getItem('edt_unified_table');
            return savedTable ? JSON.parse(savedTable) : null;
        }
        catch (e) {
            console.error("Erreur lors du chargement du tableau depuis le stockage local", e);
            return null;
        }
    });
    const [activeView, setActiveView] = useState<'extract' | 'document' | 'report'>('extract');
    
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
    const handleLogin = async (user: User) => {
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

    const handleFileChange = (selectedFiles: File[]) => {
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

    const handleDeleteResult = (id: string) => {
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
        
        let processableItems: any[] = [];
        
        // 1. Prepare items (Convert PDF to Images if needed)
        for (const file of files) {
            if (file.type === 'application/pdf') {
                try {
                    // Logic moved to services/pdfProcessing.ts
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

        const initialDataState: ExtractedData[] = processableItems.map(item => ({
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
                    // Logic moved to services/imageProcessing.ts
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
        // Logic moved to services/dataProcessing.ts
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
    const handleTableUpdate = async (newTable: TableData) => {
        setUnifiedTable(newTable);
        // Persistance immédiate
        try {
            localStorage.setItem('edt_unified_table', JSON.stringify(newTable));
        } catch (e) {
            console.error("Erreur sauvegarde update", e);
        }

        // Sauvegarde silencieuse côté Airtable pour refléter les changements chauffeur
        try {
            await syncTournees(newTable);
        } catch (e) {
            console.warn("Sync Airtable après modification échouée", e);
        }
    };

    const handlePrint = (headers: string[], rows: string[][]) => {
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
