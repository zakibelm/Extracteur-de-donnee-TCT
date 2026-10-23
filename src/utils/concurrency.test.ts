import { expect, it } from 'vitest';
import { mapConcurrent } from './concurrency';
it('limits active work and preserves original page order', async () => {
    let active = 0;
    let maximum = 0;
    const result = await mapConcurrent([4, 3, 2, 1], 2, async (value) => {
        maximum = Math.max(maximum, ++active);
        await new Promise(resolve => setTimeout(resolve, value));
        active--;
        return value;
    });
    expect(maximum).toBe(2);
    expect(result).toEqual([4, 3, 2, 1]);
});
it('propagates page failures instead of reporting a complete PDF', async () => {
    await expect(mapConcurrent([1], 2, async () => { throw new Error('page failed'); })).rejects.toThrow('page failed');
});
