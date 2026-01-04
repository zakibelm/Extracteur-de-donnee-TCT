import { useState } from 'react';
import { ExtractedData, Status, TableData } from '../types';
import { extractDataFromImage, ExtractionOptions } from '../services/unifiedAIService';
import { api } from '../services/api';
import * as pdfjsLib from 'pdfjs-dist';

interface ProcessableFile {
    id: string;
    file: File;
    originalFileName: string;
    base64: string;
    mimeType: string;
}

async function processPage(
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNum: number,
    originalPdfName: string,
    retryCount = 0
): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'> | null> {
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
        if (retryCount < 2) {
            return processPage(pdf, pageNum, originalPdfName, retryCount + 1);
        }
        return null;
    }
}

const processPdf = async (pdfFile: File): Promise<Omit<ProcessableFile, 'base64' | 'mimeType'>[]> => {
    const fileBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(fileBuffer).promise;
    const pagePromises = Array.from({ length: pdf.numPages }, (_, i) => processPage(pdf, i + 1, pdfFile.name));
    const pageResults = await Promise.all(pagePromises);
    return pageResults.filter((result): result is Omit<ProcessableFile, 'base64' | 'mimeType'> => result !== null);
};

export const useExtraction = (documentType: 'tct' | 'olymel', userId: string | undefined) => {
    const [files, setFiles] = useState<File[]>([]);
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [globalStatus, setGlobalStatus] = useState<Status>(Status.Idle);
    const [error, setError] = useState<string | null>(null);
    const [unifiedTable, setUnifiedTable] = useState<TableData | null>(null);

    const handleFileChange = (selectedFiles: File[]) => {
        setFiles(selectedFiles);
        setError(null);
        setGlobalStatus(Status.Idle);
    };

    const buildUnifiedTable = (dataList: ExtractedData[]): TableData | null => {
        const successfulExtractions = dataList.filter(
            d => d.status === Status.Success && d.content && d.content.rows.length > 0 && d.content.headers[0] !== 'Erreur'
        );

        if (successfulExtractions.length === 0) return null;

        const masterHeaders = [...successfulExtractions[0].content!.headers];
        const vehiculeIndex = masterHeaders.indexOf("Véhicule");

        if (vehiculeIndex !== -1 && documentType === 'tct') {
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
                if (vehiculeIndex !== -1 && documentType === 'tct') {
                    const vehiculeVal = newRow[vehiculeIndex] || "";
                    newRow.splice(vehiculeIndex + 1, 0, vehiculeVal, "");
                }
                return newRow;
            });
        });

        const uniqueRows = Array.from(new Set(allRows.map(row => JSON.stringify(row))))
            .map(str => JSON.parse(str as string) as string[]);

        return { headers: masterHeaders, rows: uniqueRows };
    };

    const handleExtractData = async (options: ExtractionOptions) => {
        if (files.length === 0 || !userId) return;

        setGlobalStatus(Status.Processing);
        let currentHistory = [...extractedData];
        let processableFiles: ProcessableFile[] = [];

        try {
            for (const file of files) {
                if (file.type === 'application/pdf') {
                    const pageImages = await processPdf(file);
                    for (const page of pageImages) {
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                            reader.readAsDataURL(page.file);
                        });
                        processableFiles.push({ ...page, base64, mimeType: 'image/jpeg' });
                    }
                } else {
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
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
            setError("Erreur lors de la préparation des fichiers.");
            setGlobalStatus(Status.Error);
            return;
        }

        setGlobalStatus(Status.AiProcessing);

        const placeholders = processableFiles.map(f => ({
            id: f.id,
            fileName: f.originalFileName.includes(f.file.name) ? f.file.name : f.originalFileName + " (page)",
            imageSrc: `data:${f.mimeType};base64,${f.base64}`,
            content: null,
            status: Status.Processing
        }));

        setExtractedData([...placeholders, ...currentHistory]);

        const promises = processableFiles.map(async (pFile) => {
            try {
                setExtractedData(prev => prev.map(p => p.id === pFile.id ? { ...p, status: Status.AiProcessing } : p));

                const content = await extractDataFromImage(pFile.base64, pFile.mimeType, documentType, options);
                const status = content.headers[0] === 'Erreur' ? Status.Error : Status.Success;

                const savedRecord = await api.saveExtraction({
                    id: '',
                    fileName: pFile.originalFileName,
                    imageSrc: '',
                    content,
                    status,
                    userId,
                    section: documentType
                }, userId, documentType);

                setExtractedData(prev => prev.map(p => p.id === pFile.id ? {
                    ...savedRecord,
                    imageSrc: `data:${pFile.mimeType};base64,${pFile.base64}`
                } : p));

                return { status };
            } catch (e) {
                setExtractedData(prev => prev.map(p => p.id === pFile.id ? {
                    ...p,
                    content: { headers: ['Erreur'], rows: [['Echec extraction']] },
                    status: Status.Error
                } : p));
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
        } else {
            setError("Aucune donnée valide à afficher.");
        }
    };

    const handleDeleteResult = async (id: string) => {
        try {
            await api.deleteExtraction(id);
            const updatedData = extractedData.filter(item => item.id !== id);
            setExtractedData(updatedData);

            if (unifiedTable || updatedData.length > 0) {
                const newTable = buildUnifiedTable(updatedData);
                setUnifiedTable(newTable);
            }
        } catch (e) {
            setError("Erreur lors de la suppression");
        }
    };

    const loadHistory = async (userIdParam: string) => {
        try {
            const data = await api.fetchExtractions(userIdParam, documentType);
            setExtractedData(data);
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    return {
        files,
        extractedData,
        globalStatus,
        error,
        unifiedTable,
        handleFileChange,
        handleExtractData,
        handleGenerateResults,
        handleDeleteResult,
        handleTableUpdate: setUnifiedTable,
        setExtractedData,
        loadHistory
    };
};
