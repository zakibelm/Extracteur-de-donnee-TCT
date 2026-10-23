// Import emitted modules in plain Node ESM, as deployed functions do.
// Vite/tsx resolve extensionless paths, which can hide deployment-only failures.
import assert from 'node:assert/strict';
import extraction from '../.runtime-check/api/n8n.js';
import testKey from '../.runtime-check/api/extract.js';
for (const handler of [extraction, testKey]) {
    let status;
    let body;
    const response = {
        setHeader() {},
        status(code) { status = code; return this; },
        json(value) { body = value; return this; },
    };
    const originalError = console.error;
    try {
        console.error = () => {};
        await handler({ method: 'POST', headers: {}, body: {} }, response);
    } finally { console.error = originalError; }
    assert.equal(status, 401, 'A request without a session must return 401');
    assert.equal(typeof body.error, 'string');
}
console.log('Server ESM imports and authentication checks passed.');
