
/**
 * <summary>
 * Gain de performance : Le traitement des pages PDF est maintenant parallélisé, réduisant le temps de conversion (ex: de 5s à 0.5s pour 10 pages).
 * Robustesse accrue : La conversion de chaque page est isolée ; un échec sur une page n'arrête plus le traitement du PDF entier.
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

// Helper function to build unified table logic (reusable)
const buildUnifiedTable = (dataList: ExtractedData[]): TableData | null => {
    const successfulExtractions = dataList
        .filter(d => d.status === Status.Success && d.content && d.content.rows.length > 0 && d.content.headers[0] !== 'Erreur');

    if (successfulExtractions.length === 0) {
        return null;
    }

    // Clone des en-têtes pour ne pas muter l'objet original
    const masterHeaders = [...successfulExtractions[0].content!.headers];
    
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
            return d.content!.rows.map(row => {
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
        .map(str => JSON.parse(str as string) as string[]);
        
    return {
        headers: masterHeaders,
        rows: uniqueRows,
    };
};


const App: React.FC = () => {
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

    const [activeView, setActiveView] = useState<'extract' | 'document' | 'report'>('extract');

    // Effet pour basculer automatiquement sur la vue document si un tableau est restauré
    useEffect(() => {
        if (unifiedTable && extractedData.length === 0) {
            setActiveView('document');
        }
    }, []); // Ne s'exécute qu'au montage

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
        localStorage.removeItem('edt_unified_table'); // Sécurité : nettoyer le stockage local
    };

    const handleFileChange = (selectedFiles: File[]) => {
        setFiles(selectedFiles);
        setExtractedData([]);
        setError(null);
        setUnifiedTable(null);
        setGlobalStatus(Status.Idle);
        setActiveView('extract');
        localStorage.removeItem('edt_unified_table'); // Nettoyer le stockage pour recommencer à zéro (Nouveau cycle)
    };

    const handleDeleteResult = (id: string) => {
        // 1. Mettre à jour les données extraites
        const updatedData = extractedData.filter(item => item.id !== id);
        setExtractedData(updatedData);

        // 2. Si un tableau unifié existait, on le met à jour dynamiquement
        // Cela permet de garder la cohérence sans avoir à recliquer sur "Générer"
        if (unifiedTable || updatedData.length > 0) {
            const newTable = buildUnifiedTable(updatedData);
            if (newTable) {
                setUnifiedTable(newTable);
                try {
                    localStorage.setItem('edt_unified_table', JSON.stringify(newTable));
                } catch (e) {
                     console.warn("Impossible de sauvegarder après suppression (Quota ?)", e);
