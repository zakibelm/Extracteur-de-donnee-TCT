import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./uploads', () => ({ readFileAsBase64: vi.fn() }));
import { readFileAsBase64 } from './uploads';
import { prepareImage, MAX_EXTRACTION_BASE64 } from './prepareImage';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('keeps a small original without lossy recompression', async () => {
    vi.mocked(readFileAsBase64).mockResolvedValue('YWJj');
    await expect(prepareImage(new File(['abc'], 'scan.png', { type: 'image/png' }))).resolves.toEqual({ base64: 'YWJj', mimeType: 'image/png' });
});
it('fits a large camera image under the API limit and paints transparent areas white', async () => {
    vi.mocked(readFileAsBase64).mockResolvedValue('a'.repeat(MAX_EXTRACTION_BASE64 + 1));
    vi.stubGlobal('Image', class {
        naturalWidth = 4000; naturalHeight = 2000; onload?: () => void;
        set src(_: string) { queueMicrotask(() => this.onload?.()); }
    });
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,YWJj') };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as never);
    await expect(prepareImage(new File(['abc'], 'camera.png', { type: 'image/png' }))).resolves.toEqual({ base64: 'YWJj', mimeType: 'image/jpeg' });
    expect(canvas.width).toBe(3200); expect(canvas.height).toBe(1600);
    expect(context.fillStyle).toBe('#fff'); expect(context.drawImage).toHaveBeenCalled();
});
