import { expect, it } from 'vitest';
import { parseVisionModels } from './visionModels';
it('keeps image readers, excludes text-only and image generation, sorts newest first', () => {
    const model = (id: string, input: string[], output: string[], created: number) => ({ id, name: id, created,
        architecture: { input_modalities: input, output_modalities: output } });
    expect(parseVisionModels({ data: [
        model('text', ['text'], ['text'], 4), model('image-generator', ['image'], ['text', 'image'], 3),
        model('older-vision', ['image', 'text'], ['text'], 1), model('newer-vision', ['image'], ['text'], 2),
    ] }).map(m => m.id)).toEqual(['newer-vision', 'older-vision']);
});
it('rejects a malformed catalog rather than offering an obsolete fallback', () => {
    expect(() => parseVisionModels({})).toThrow();
});
