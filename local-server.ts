import 'dotenv/config';
import { createServer } from 'node:http';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import extractionHandler from './api/n8n';
import testHandler from './api/extract';

const handlers = { '/api/n8n': extractionHandler, '/api/extract': testHandler };
const port = Number(process.env.PORT || 3002);

// Same handlers as Vercel. No simulated login or simulated successful writes.
createServer(async (req, res) => {
    const handler = handlers[(req.url || '').split('?')[0]];
    if (!handler) { res.writeHead(404); res.end(); return; }
    let body = '';
    try {
        for await (const chunk of req) {
            body += chunk.toString();
            if (Buffer.byteLength(body) > 4 * 1024 * 1024) {
                res.writeHead(413); res.end(); return;
            }
        }
        const request = Object.assign(req, { body: body ? JSON.parse(body) : {} }) as VercelRequest;
        const response = Object.assign(res, {
            status(code: number) { res.statusCode = code; return response; },
            json(value: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return response; },
        }) as VercelResponse;
        await handler(request, response);
    } catch {
        if (!res.headersSent) res.writeHead(400);
        res.end();
    }
}).listen(port, '127.0.0.1', () => console.log(`API locale : http://127.0.0.1:${port}`));
