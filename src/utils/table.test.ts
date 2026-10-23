import { describe, it, expect } from 'vitest';
import { buildUnifiedTable, validateTable, TCT_HEADERS, toTctRecords } from './table';
import { Status, ExtractedData } from '../types';
const row = TCT_HEADERS.map((_, i) => `cell-${i}`);
const extraction = (rows = [row], headers: string[] = [...TCT_HEADERS]): ExtractedData => ({
    id: 'one', fileName: 'sample.png', imageSrc: '', status: Status.Success, content: { headers, rows },
});
describe('table integrity', () => {
    it('preserves all 14 columns including vehicle, approval and both addresses', () => {
        const result = buildUnifiedTable([extraction()])!;
        expect(result.rows[0]).toEqual(row);
        expect(result.rows[0]).toHaveLength(result.headers.length);
        expect(result.rows[0][7]).toBe('cell-7');
        expect(result.rows[0][13]).toBe('cell-13');
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

it('maps real source fields without duplicating employee IDs', () => {
    const values = ['TCT0004','TAXI COOP TERREBONNE','6:30','7:17','TAXI','0458',
        'Nom synthétique','212','TAXI','','Oui','104','Adresse début...','Adresse fin'];
    const record = toTctRecords({ headers: [...TCT_HEADERS], rows: [values] })[0];
    expect(record.employe).toBe('0458');
    expect(record.vehicule).toBe('212');
    expect(record.stationnement).toBe('');
    expect(record.territoire_debut).toBe('104');
    expect(record.adresse_debut).toBe('Adresse début...');
    expect(Object.keys(record)).toHaveLength(14);
});
it('keeps the schedule date and rejects different schedule dates in one consolidation', () => {
    const first = extraction(); first.content!.metadata = { schedule_date: '2026-10-23' };
    expect(buildUnifiedTable([first])!.metadata?.schedule_date).toBe('2026-10-23');
    const other = extraction(); other.content!.metadata = { schedule_date: '2026-10-24' };
    expect(() => buildUnifiedTable([first, other])).toThrow('dates');
});
