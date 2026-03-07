import { useState, useEffect, useCallback } from 'react';

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ResourceState<T> {
    data: T | null;
    status: ResourceStatus;
    error: string | null;
    reload: () => void;
}

/**
 * Generic hook for fetching any API resource.
 *
 * Usage:
 *   const { data, status, error, reload } = useResource(() => apiService.listDownloaders());
 *
 * Pass `enabled: false` to defer the initial fetch (e.g. until the tab is visible).
 */
export function useResource<T>(
    fetcher: () => Promise<T>,
    options: { enabled?: boolean } = {}
): ResourceState<T> {
    const { enabled = true } = options;

    const [data,   setData]   = useState<T | null>(null);
    const [status, setStatus] = useState<ResourceStatus>('idle');
    const [error,  setError]  = useState<string | null>(null);
    const [tick,   setTick]   = useState(0);

    const reload = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        setStatus('loading');
        setError(null);

        fetcher()
            .then(result => {
                if (!cancelled) {
                    setData(result);
                    setStatus('success');
                }
            })
            .catch(err => {
                if (!cancelled) {
                    const msg =
                        err?.body?.detail ??
                        err?.body?.message ??
                        err?.message ??
                        'Unknown error';
                    setError(String(msg));
                    setStatus('error');
                }
            });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, tick]);

    return { data, status, error, reload };
}

