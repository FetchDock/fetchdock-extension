import React from 'react';
import { RefreshCw, AlertCircle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ResourceStatus } from './useResource';

/**
 * Column definition for the ResourcePanel table.
 *
 * @template T  The row data type.
 */
export interface ColumnDef<T> {
    key: string;
    header: string;
    /** Width hint, e.g. "w-16" or "w-1/3". Defaults to auto. */
    width?: string;
    render: (row: T) => React.ReactNode;
}

interface ResourcePanelProps<T> {
    /** Human-readable label shown in the card header */
    title: string;
    /** Optional description shown below the title */
    description?: string;
    /** lucide-react icon component */
    icon?: React.ReactNode;
    columns: ColumnDef<T>[];
    rows: T[] | null;
    status: ResourceStatus;
    error: string | null;
    onReload: () => void;
    /** Key extractor for React list reconciliation */
    getRowKey: (row: T) => string | number;
    /** Optional action slot rendered in the card header (right side) */
    headerAction?: React.ReactNode;
}

function SkeletonRow({ cols }: { cols: number }) {
    return (
        <tr className="border-b border-border">
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <div className="h-4 rounded bg-muted animate-pulse" />
                </td>
            ))}
        </tr>
    );
}

export function ResourcePanel<T>({
    title,
    description,
    icon,
    columns,
    rows,
    status,
    error,
    onReload,
    getRowKey,
    headerAction,
}: ResourcePanelProps<T>) {
    const isLoading = status === 'loading' || status === 'idle';
    const isEmpty   = status === 'success' && (!rows || rows.length === 0);

    return (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                    {icon && (
                        <span className="text-muted-foreground">{icon}</span>
                    )}
                    <div>
                        <h2 className="text-base font-semibold leading-tight">{title}</h2>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {headerAction}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onReload}
                        disabled={isLoading}
                        title="Refresh"
                    >
                        <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/40">
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        'px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide',
                                        col.width
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {/* Loading skeletons */}
                        {isLoading && Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonRow key={i} cols={columns.length} />
                        ))}

                        {/* Error state */}
                        {status === 'error' && (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-10 text-center">
                                    <div className="flex flex-col items-center gap-2 text-destructive">
                                        <AlertCircle className="w-6 h-6" />
                                        <span className="text-sm">{error}</span>
                                        <Button variant="outline" size="sm" onClick={onReload}>
                                            Retry
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {/* Empty state */}
                        {isEmpty && (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-10 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Inbox className="w-6 h-6" />
                                        <span className="text-sm">No records found</span>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {/* Data rows */}
                        {status === 'success' && rows && rows.map(row => (
                            <tr
                                key={getRowKey(row)}
                                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                            >
                                {columns.map(col => (
                                    <td key={col.key} className={cn('px-4 py-3', col.width)}>
                                        {col.render(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

