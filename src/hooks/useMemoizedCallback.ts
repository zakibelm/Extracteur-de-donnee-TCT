import { useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for memoized callbacks with latest values
 * Prevents unnecessary re-renders while keeping callback reference stable
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
    callback: T
): T {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback(((...args) => callbackRef.current(...args)) as T, []);
}
