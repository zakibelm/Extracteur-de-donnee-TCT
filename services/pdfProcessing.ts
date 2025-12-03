
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path for pdf.js to match the version from the import map
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@5.4.394/build/pdf.worker.mjs`;

interface PageResult {
    file: File;
    originalFileName: string;
    id: string;
}

/**
 * Processes a single page of a PDF document into an image File object.
 */
async function processPage(pdf: any, pageNum: number, originalPdfName: string): Promise<PageResult | null> {
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
        return null;
    }
}

/**
 * Converts all pages of a PDF file into an array of image files.
 * Batched to 1 to avoid memory overflow on mobile/cloud run.
 */
export const processPdf = async (pdfFile: File): Promise<PageResult[]> => {
    console.time(`PDF_Convert_${pdfFile.name}`);
    const fileBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(fileBuffer).promise;
    
    // Process pages sequentially to ensure stability
    const BATCH_SIZE = 1;
    let allPageResults: (PageResult | null)[] = [];

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
    return allPageResults.filter((result): result is PageResult => result !== null);
};
