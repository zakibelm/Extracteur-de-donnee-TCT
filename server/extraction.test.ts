vi.mock('./visionModels', () => ({ requireVisionModel: vi.fn().mockResolvedValue({ supportedParameters: ['temperature', 'response_format'], maxCompletionTokens: 12000 }) }));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
vi.mock('./auth', async importOriginal => {
    const original = await importOriginal<typeof import('./auth')>();
    return { ...original, requireAdmin: vi.fn() };
});
import { requireAdmin, HttpError } from './auth';
import handler from '../api/n8n';
import { TCT_HEADERS } from '../src/utils/table';

const body = { image: 'YWJj', section: 'tct', mimeType: 'image/png' };
const run = async (requestBody = body, headers = {}) => {
    const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    await handler({ method: 'POST', headers, body: requestBody } as unknown as VercelRequest,
        res as unknown as VercelResponse);
    return res;
};
beforeEach(() => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'verified-uuid', user_metadata: { numDome: 'test' } } as never);
    vi.stubEnv('N8N_EXTRACT_WEBHOOK', 'https://example.test/webhook/extract');
    vi.stubEnv('N8N_WEBHOOK_SECRET', 'test-server-secret');
    vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('does not call n8n when authentication is refused', async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new HttpError(401, 'No session'));
    const res = await run();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(fetch).not.toHaveBeenCalled();
});
it('rejects invalid image data before calling n8n', async () => {
    const res = await run({ ...body, image: '<script>' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
});
it('sends only the verified identity and the server webhook secret', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ headers: TCT_HEADERS, rows: [] }), { status: 200 }));
    const res = await run({ ...body, user_id: 'forged-id' } as typeof body);
    expect(res.status).toHaveBeenCalledWith(200);
    const options = vi.mocked(fetch).mock.calls[0][1]!;
    expect(JSON.parse(options.body as string).user_id).toBe('verified-uuid');
    expect(options.headers).toMatchObject({ 'X-Webhook-Secret': 'test-server-secret' });
});
it('rejects a malformed extraction response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ headers: TCT_HEADERS, rows: [['misaligned']] }), { status: 200 }));
    const res = await run();
    expect(res.status).toHaveBeenCalledWith(502);
});
it('does not report backend failures as success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('failed', { status: 500 }));
    const res = await run();
    expect(res.status).toHaveBeenCalledWith(502);
});
it('uses OpenRouter when n8n is not configured and a server key is available', async () => {
    vi.stubEnv('N8N_EXTRACT_WEBHOOK', ''); vi.stubEnv('N8N_WEBHOOK_SECRET', '');
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ headers: TCT_HEADERS, rows: [] }) }, finish_reason: 'stop' }] }), { status: 200 }));
    const res = await run();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
});
it('explains how to configure analysis if neither service nor API key is present', async () => {
    vi.stubEnv('N8N_EXTRACT_WEBHOOK', ''); vi.stubEnv('N8N_WEBHOOK_SECRET', ''); vi.stubEnv('OPENROUTER_API_KEY', '');
    const res = await run();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Paramètres') }));
    expect(fetch).not.toHaveBeenCalled();
});
it('reports insufficient credits without exposing provider details or keys', async () => {
    vi.stubEnv('N8N_EXTRACT_WEBHOOK', ''); vi.stubEnv('N8N_WEBHOOK_SECRET', ''); vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
    vi.mocked(fetch).mockResolvedValue(new Response('private provider detail', { status: 402 }));
    const res = await run();
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/crédits/i) }));
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('test-key');
});

it('uses the same explicit key and model as the successful settings test, ahead of server configuration', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'stale-server-key');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ headers: TCT_HEADERS, rows: [] }) } }] })));
    const res = await run({ ...body, model: 'openai/gpt-4.1' } as typeof body, { 'x-api-key': 'tested-client-key' });
    expect(res.status).toHaveBeenCalledWith(200);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer tested-client-key' });
    expect(JSON.parse(options?.body as string).model).toBe('openai/gpt-4.1');
});
