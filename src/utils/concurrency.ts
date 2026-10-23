/** Preserve input order while limiting concurrent PDF/AI work on tablets. */
export async function mapConcurrent<T, R>(items: readonly T[], limit: number,
    action: (item: T, index: number) => Promise<R>): Promise<R[]> {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid concurrency');
    const results: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await action(items[index], index);
        }
    }));
    return results;
}
