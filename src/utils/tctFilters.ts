const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const tokens = (query: string) => query.split(/[+,;\s]+/).map(normalize).filter(Boolean);
const numericId = (value: string) => value.replace(/^0+(?=\d)/, '');
export function matchesTctId(value: string, query: string, tournee = false): boolean {
    const terms = tokens(query);
    const cell = normalize(value).replace(tournee ? /^tct/ : /^$/, '');
    return !terms.length || terms.some(term => {
        const target = term.replace(tournee ? /^tct/ : /^$/, '');
        if (/^\d+$/.test(cell) && /^\d+$/.test(target)) return numericId(cell) === numericId(target);
        return cell === target;
    });
}
