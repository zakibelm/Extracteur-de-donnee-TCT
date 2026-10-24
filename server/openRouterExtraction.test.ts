import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./visionModels', () => ({ requireVisionModel: vi.fn() }));
import { requireVisionModel } from './visionModels';
import { extractWithOpenRouter } from './openRouterExtraction';
const input = { image: 'YWJj', mimeType: 'image/png', section: 'tct', model: 'openai/gpt-4.1-mini' };
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
it('only sends parameters supported by the selected model and respects output limits', async () => {
    vi.mocked(requireVisionModel).mockResolvedValue({ id: 'test/vision', name: 'Vision', created: 0, supportedParameters: [], maxCompletionTokens: 4096 });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"rows":[]}' } }] })));
    vi.stubGlobal('fetch', fetchMock);
    await extractWithOpenRouter(input, 'private-key');
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.response_format.type).toBe('json_schema');
    expect(request.response_format.json_schema.schema.properties.rows.items.type).toBe('object');
    expect(request.response_format.json_schema.schema.properties.rows.items.required).toContain('employe_affecte');
    expect(request).not.toHaveProperty('temperature');
    expect(request.max_tokens).toBe(4096);
    expect(request.messages[1].content[1].type).toBe('image_url');
});
it.each([[402, 'crédits'], [404, 'fournisseur'], [429, 'limité'], [403, 'Accès refusé']])('explains HTTP %s without exposing upstream secrets', async (status, fragment) => {
    vi.mocked(requireVisionModel).mockResolvedValue({ supportedParameters: [], maxCompletionTokens: 12000 } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private-key' } }), { status })));
    await expect(extractWithOpenRouter(input, 'private-key')).rejects.toThrow(new RegExp(fragment, 'i'));
});

it('rejects unapproved image models before any upstream call', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(extractWithOpenRouter({ ...input, model: 'preview/vision' }, 'private-key')).rejects.toThrow('non pris en charge');
    expect(fetchMock).not.toHaveBeenCalled();
});
it('strips unreadable null metadata while preserving leading-zero cells', async () => {
    vi.mocked(requireVisionModel).mockResolvedValue({ supportedParameters: [], maxCompletionTokens: 12000 } as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rows: [['0458']], metadata: { schedule_date: null, heure_de_pointe: '08:22' } }) } }] }))));
    await expect(extractWithOpenRouter(input, 'key')).resolves.toEqual({ rows: [['0458']], metadata: { heure_de_pointe: '08:22' } });
});
