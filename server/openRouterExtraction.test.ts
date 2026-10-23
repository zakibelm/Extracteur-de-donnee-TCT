import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./visionModels', () => ({ requireVisionModel: vi.fn() }));
import { requireVisionModel } from './visionModels';
import { extractWithOpenRouter } from './openRouterExtraction';
const input = { image: 'YWJj', mimeType: 'image/png', section: 'tct', model: 'test/vision' };
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
it('only sends parameters supported by the selected model and respects output limits', async () => {
    vi.mocked(requireVisionModel).mockResolvedValue({ id: 'test/vision', name: 'Vision', created: 0, supportedParameters: [], maxCompletionTokens: 4096 });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"rows":[]}' } }] })));
    vi.stubGlobal('fetch', fetchMock);
    await extractWithOpenRouter(input, 'private-key');
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).not.toHaveProperty('response_format');
    expect(request).not.toHaveProperty('temperature');
    expect(request.max_tokens).toBe(4096);
    expect(request.messages[1].content[1].type).toBe('image_url');
});
it.each([[402, 'crédits'], [404, 'fournisseur'], [429, 'limité'], [403, 'Accès refusé']])('explains HTTP %s without exposing upstream secrets', async (status, fragment) => {
    vi.mocked(requireVisionModel).mockResolvedValue({ supportedParameters: [], maxCompletionTokens: 12000 } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private-key' } }), { status })));
    await expect(extractWithOpenRouter(input, 'private-key')).rejects.toThrow(new RegExp(fragment, 'i'));
});
