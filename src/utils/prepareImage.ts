import { readFileAsBase64 } from './uploads';
export const MAX_EXTRACTION_BASE64 = 3_400_000;

// Keep small originals lossless. Large camera images/PDF pages must fit the
// API's 4 MB body limit, while keeping enough resolution for small table text.
export async function prepareImage(file: File): Promise<{ base64: string; mimeType: string }> {
    const original = await readFileAsBase64(file);
    if (original.length <= MAX_EXTRACTION_BASE64) return { base64: original, mimeType: file.type };
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        const timer = setTimeout(() => reject(new Error('Préparation de l’image trop longue. Réessayez avec une page.')), 30000);
        image.onload = () => { clearTimeout(timer); resolve(image); };
        image.onerror = () => { clearTimeout(timer); reject(new Error('Image illisible. Réexportez le document en JPG ou PNG.')); };
        image.src = `data:${file.type};base64,${original}`;
    });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 3200 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Préparation de l’image impossible sur cet appareil.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.82, 0.7, 0.55]) {
        const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        if (base64 && base64.length <= MAX_EXTRACTION_BASE64) return { base64, mimeType: 'image/jpeg' };
    }
    throw new Error('Image trop volumineuse après préparation. Recadrez une seule page du tableau.');
}
