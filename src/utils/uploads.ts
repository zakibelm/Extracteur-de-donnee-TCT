const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' };
export const UPLOAD_ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf';

export function normalizeUploads(files: File[]): { files: File[]; errors: string[] } {
    const accepted: File[] = [];
    const errors: string[] = [];
    for (const file of files) {
        const declared = file.type.toLowerCase();
        const fallback = !declared || ['application/octet-stream', 'binary/octet-stream'].includes(declared);
        const type = fallback ? TYPES[file.name.split('.').pop()?.toLowerCase() || '']
            : declared === 'image/jpg' ? 'image/jpeg' : declared;
        if (!Object.values(TYPES).includes(type)) { errors.push(`${file.name} : utilisez une image PNG, JPG, WEBP ou un PDF.`); continue; }
        if (!file.size) { errors.push(`${file.name} : fichier vide ou inaccessible.`); continue; }
        if (file.size > 50 * 1024 * 1024) { errors.push(`${file.name} : maximum 50 Mo par fichier.`); continue; }
        accepted.push(file.type === type ? file : new File([file], file.name, { type, lastModified: file.lastModified }));
    }
    return { files: accepted, errors };
}

export function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const timeout = setTimeout(() => reader.abort(), 30_000);
        const fail = () => { clearTimeout(timeout); reject(new Error(`Lecture impossible : ${file.name}. Téléchargez d'abord ce fichier sur l'appareil puis réessayez.`)); };
        reader.onerror = fail;
        reader.onabort = fail;
        reader.onload = () => {
            clearTimeout(timeout);
            if (typeof reader.result !== 'string' || !reader.result.includes(',')) return fail();
            const base64 = reader.result.slice(reader.result.indexOf(',') + 1);
            if (!base64) return fail();
            resolve(base64);
        };
        reader.readAsDataURL(file);
    });
}
