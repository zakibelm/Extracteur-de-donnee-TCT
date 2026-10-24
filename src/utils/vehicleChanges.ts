import { TableData, User } from '../types';

export function recordVehicleChange(table: TableData, rowIndex: number, value: string, user: User, changedAt = new Date().toISOString()): TableData {
    const column = table.headers.indexOf('Véhicule');
    const original = table.rows[rowIndex];
    const next = value.trim();
    if (column < 0 || !original || original[column] === next || !user.isAdmin) return table;
    const row = [...original];
    row[column] = next;
    return {
        ...table,
        rows: table.rows.map((current, index) => index === rowIndex ? row : [...current]),
        metadata: {
            ...table.metadata,
            vehicle_changes: [...(table.metadata?.vehicle_changes || []), {
                headers: [...table.headers], row: [...row],
                old_vehicle: original[column], new_vehicle: next,
                user_id: user.id, user_dome: user.numDome, changed_at: changedAt,
            }],
        },
    };
}

export function buildVehicleReport(table: TableData) {
    const changes = table.metadata?.vehicle_changes || [];
    const auditHeaders = ['Ancien véhicule', 'Nouveau véhicule', 'Changement par', 'Date et heure (UTC)'];
    return {
        headers: [...table.headers, ...auditHeaders],
        rows: changes.map(change => [
            ...table.headers.map(header => change.row[change.headers.indexOf(header)] || ''),
            change.old_vehicle, change.new_vehicle, change.user_dome || change.user_id, change.changed_at,
        ]),
    };
}
