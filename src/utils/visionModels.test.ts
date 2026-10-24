import { expect, it } from 'vitest';
import { parseVisionModels, DEFAULT_VISION_MODEL } from './visionModels';
const model = (id: string, parameters = ['response_format', 'structured_outputs']) => ({ id, name: id, created: 1,
    supported_parameters: parameters, architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } });
it('offers only the two application models in recommended order', () => {
    const result = parseVisionModels({ data: [model('openai/gpt-4.1'), model('openai/gpt-4o-mini'),
        model('preview/vision'), model('openai/gpt-4.1-mini')] });
    expect(result.map(m => m.id)).toEqual([DEFAULT_VISION_MODEL, 'openai/gpt-4.1']);
});
it('removes even a shortlisted model if vision or structured output disappears', () => {
    expect(parseVisionModels({ data: [model(DEFAULT_VISION_MODEL, ['response_format']),
        { ...model('openai/gpt-4.1'), architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] })).toEqual([]);
});
it('rejects a malformed catalog', () => { expect(() => parseVisionModels({})).toThrow(); });
