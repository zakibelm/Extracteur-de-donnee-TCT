import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it('checks capabilities, caches public catalog and rejects retired models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
        { id: 'openai/gpt-4.1-mini', name: 'Vision', supported_parameters: ['structured_outputs', 'response_format'], architecture: { input_modalities: ['image'], output_modalities: ['text'] } },
        { id: 'test/text', name: 'Text', architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
    ] })));
    vi.stubGlobal('fetch', fetchMock);
    const { requireVisionModel } = await import('./visionModels');
    await expect(requireVisionModel('openai/gpt-4.1-mini')).resolves.toMatchObject({ id: 'openai/gpt-4.1-mini' });
    await expect(requireVisionModel('test/text')).rejects.toMatchObject({ status: 400 });
    await expect(requireVisionModel('retired/model')).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('headers');
});
it('reports catalog failure without inventing current model availability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    const { getVisionModels } = await import('./visionModels');
    await expect(getVisionModels()).rejects.toMatchObject({ status: 503 });
});
