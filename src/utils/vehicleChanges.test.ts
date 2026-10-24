import { expect, it } from 'vitest';
import { recordVehicleChange, buildVehicleReport } from './vehicleChanges';
import { TCT_HEADERS, TCT_DISPATCH_HEADERS, validateTctTable } from './table';
import { User } from '../types';
const user: User = { id: 'owner', numDome: '203', idEmploye: 'test', isAdmin: true };
for (const headers of [TCT_HEADERS, TCT_DISPATCH_HEADERS]) {
    it('preserves complete immutable change snapshots for '+headers.length+' columns after serialization', () => {
        const row = headers.map(h => h === 'Tournée' ? 'TCT0033' : h === 'Véhicule' ? '430' : h === 'Cl véh aff' ? 'TAXI' : '');
        const original = { headers: [...headers], rows: [row], metadata: { schedule_date: '2026-10-24' } };
        const first = recordVehicleChange(original, 0, ' 203 ', user, '2026-10-24T12:00:00.000Z');
        const second = recordVehicleChange(first, 0, '919', user, '2026-10-24T13:00:00.000Z');
        const restored = validateTctTable(JSON.parse(JSON.stringify(second)));
        const report = buildVehicleReport(restored);
        expect(report.rows).toHaveLength(2);
        expect(report.rows[0].slice(0, headers.length)).toEqual(first.rows[0]);
        expect(report.rows[0].slice(-4)).toEqual(['430','203','203','2026-10-24T12:00:00.000Z']);
        expect(report.rows[1].slice(-4)).toEqual(['203','919','203','2026-10-24T13:00:00.000Z']);
        expect(original.rows[0][headers.indexOf('Véhicule')]).toBe('430');
        expect(buildVehicleReport(original).rows).toEqual([]);
        expect(recordVehicleChange(second,0,'919',user)).toBe(second);
        expect(recordVehicleChange(second,0,'500',{...user,isAdmin:false})).toBe(second);
    });
}
