
/**
 * Optimise et compresse une image pour le traitement mobile et l'upload API.
 * Utilise des Blobs et l'API Canvas pour réduire l'empreinte mémoire.
 */
export const optimizeImageForMobile = async (file: File): Promise<string> => {
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

            // Helper: Get Blob promise
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
