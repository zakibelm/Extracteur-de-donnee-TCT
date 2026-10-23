import { describe, expect, it } from 'vitest';
import { normalizeUploads, readFileAsBase64 } from './uploads';
describe('document selection', () => {
    it('accepts files without MIME supplied by Android providers', () => {
        const result = normalizeUploads([new File(['image'], 'capture.JPG'), new File(['pdf'], 'horaire.pdf', { type: 'application/octet-stream' })]);
        expect(result.errors).toEqual([]);
        expect(result.files.map(file => file.type)).toEqual(['image/jpeg', 'application/pdf']);
    });
    it('reports unsupported and empty files instead of silently ignoring selection', () => {
        const result = normalizeUploads([new File(['x'], 'bad.doc'), new File([], 'empty.png', { type: 'image/png' })]);
        expect(result.files).toEqual([]);
        expect(result.errors).toHaveLength(2);
    });
    it('normalizes image/jpg while preserving the filename and content', async () => {
        const result = normalizeUploads([new File(['abc'], 'my.jpg', { type: 'image/jpg' })]);
        expect(result.files[0].name).toBe('my.jpg');
        expect(await readFileAsBase64(result.files[0])).toBe('YWJj');
    });
});
