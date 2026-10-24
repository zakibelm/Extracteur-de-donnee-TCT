// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('does not track environment files or embed PostgreSQL credentials in source', () => {
    const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    expect(paths.filter(p => /(^|\/)\.env(?:\.|$)/.test(p) && !p.endsWith('.env.example'))).toEqual([]);
    const matches = paths.filter(p => existsSync(p) && !p.endsWith('package-lock.json')).filter(p => {
        const text = readFileSync(p, 'utf8');
        return /postgres(?:ql)?:\/\/[^\s/"'`]+:[^\s@"'`]+@/.test(text);
    });
    // Report filenames only; never echo matched credentials into CI logs.
    expect(matches).toEqual([]);
});
