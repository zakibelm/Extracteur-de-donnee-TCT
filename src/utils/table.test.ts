import { describe, it, expect } from 'vitest';
import { buildUnifiedTable, validateTable, TCT_HEADERS } from './table';
import { Status, ExtractedData } from '../types';
const row = TCT_HEADERS.map((_, i) => `cell-${i}`);
const extraction = (rows = [row], headers: string[] = [...TCT_HEADERS]): ExtractedData => ({
    id: 'one', fileName: 'sample.png', imageSrc: '', status: Status.Success, content: { headers, rows },
});
describe('table integrity', () => {
    it('preserves all 15 columns including vehicle, approval and both addresses', () => {
        const result = buildUnifiedTable([extraction()])!;
        expect(result.rows[0]).toEqual(row);
        expect(result.rows[0]).toHaveLength(result.headers.length);
        expect(result.rows[0][8]).toBe('cell-8');
        expect(result.rows[0][14]).toBe('cell-14');
    });
    it('rejects extra or missing cells before consolidation', () => {
        expect(() => buildUnifiedTable([extraction([[...row, 'extra']])])).toThrow('Alignement');
        expect(() => buildUnifiedTable([extraction([row.slice(1)])])).toThrow('Alignement');
    });
    it('rejects changed header order across pages', () => {
        expect(() => buildUnifiedTable([extraction(), extraction([row], [...TCT_HEADERS].reverse())])).toThrow('colonnes');
    });
    it('deduplicates exact rows without changing source arrays', () => {
        const data = extraction([row, [...row]]);
        expect(buildUnifiedTable([data])!.rows).toEqual([row]);
        expect(data.content!.rows).toHaveLength(2);
    });
    it('rejects malformed backend responses', () => {
        expect(() => validateTable({ headers: ['A'], rows: [[12]] })).toThrow();
        expect(() => validateTable({ headers: ['A', 'A'], rows: [] })).toThrow();
        expect(() => validateTable({ headers: [], rows: [] })).toThrow();
    });
    it('supports Olymel without adding TCT columns', () => {
        expect(buildUnifiedTable([extraction([['a','b']], ['Date','Heure'])])!.rows).toEqual([['a','b']]);
    });
});
