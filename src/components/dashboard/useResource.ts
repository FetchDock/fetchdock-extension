import { useState, useEffect, useCallback } from 'react';

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

/** Shape of a JSON-LD collection response from the server */
export interface HydraCollection<T> {
    '@context'?: string;
    '@id'?: string;
    '@type'?: string;
    member: T[];
    totalItems: number;
    view?: {
        '@id'?: string;
        next?: string;
        previous?: string;
        last?: string;
        first?: string;
    };
}

export interface PagedResourceState<T> {
    rows: T[];
    totalItems: number;
    totalPages: number;
    page: number;
    pageSize: number;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
    status: ResourceStatus;
    error: string | null;
    reload: () => void;
}

/**
 * Generic hook for fetching a paginated JSON-LD collection.
 *
 * The fetcher receives the current page number (1-based) and page size.
 * pageSize is managed as state so callers can change it at runtime.
 *
 * Usage:
 *   const paged = usePagedResource((page, size) => apiService.listDownloadJobs(page, size));
 */
export function usePagedResource<T>(
    fetcher: (page: number, pageSize: number) => Promise<HydraCollection<T>>,
    options: { enabled?: boolean; initialPageSize?: number } = {}
): PagedResourceState<T> {
    const { enabled = true, initialPageSize = 30 } = options;

    const [rows,       setRows]       = useState<T[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [page,       setPageState]  = useState(1);
    const [pageSize,   setPageSizeState] = useState(initialPageSize);
    const [status,     setStatus]     = useState<ResourceStatus>('idle');
    const [error,      setError]      = useState<string | null>(null);
    const [tick,       setTick]       = useState(0);

    const reload  = useCallback(() => setTick(t => t + 1), []);
    const setPage = useCallback((p: number) => { setPageState(p); setTick(t => t + 1); }, []);
    // Changing page size resets to page 1
    const setPageSize = useCallback((s: number) => {
        setPageSizeState(s);
        setPageState(1);
        setTick(t => t + 1);
    }, []);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        setStatus('loading');
        setError(null);

        fetcher(page, pageSize)
            .then(result => {
                if (!cancelled) {
                    setRows(result.member ?? []);
                    setTotalItems(result.totalItems ?? 0);
                    setStatus('success');
                }
            })
            .catch(err => {
                if (!cancelled) {
                    const msg =
                        err?.body?.detail ??
                        err?.body?.description ??
                        err?.body?.message ??
                        err?.message ??
                        'Unknown error';
                    setError(String(msg));
                    setStatus('error');
                }
            });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, page, pageSize, tick]);

    return { rows, totalItems, totalPages, page, pageSize, setPage, setPageSize, status, error, reload };
}

// Keep the old hook for non-paginated uses (e.g. a fixed-size list)
export interface ResourceState<T> {
    data: T | null;
    status: ResourceStatus;
    error: string | null;
    reload: () => void;
}

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
