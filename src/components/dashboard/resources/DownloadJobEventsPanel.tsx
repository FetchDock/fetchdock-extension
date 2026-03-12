import React, { useState, useCallback } from 'react';
import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResourcePanel, type ColumnDef } from '@/components/dashboard/ResourcePanel';
import { usePagedResource } from '@/components/dashboard/useResource';
import { Pagination } from '@/components/dashboard/Pagination';
import { apiService } from '@/service/apiService';

interface DownloadJobEventLD {
    '@id'?: string;
    id?: any;
    // downloadJob may be an IRI in JSON-LD
    downloadJob?: string;
    workerIdentifier?: any;
    event?: any;
    source?: any;
    updateMessage?: any;
    exceptionMessage?: any;
    createdAt?: any;
}


function eventVariant(event: string): 'success' | 'destructive' | 'warning' | 'secondary' {
    const e = String(event).toLowerCase();
    if (e.includes('complet') || e.includes('success') || e.includes('finish')) return 'success';
    if (e.includes('fail') || e.includes('error') || e.includes('abort'))       return 'destructive';
    if (e.includes('start') || e.includes('progress') || e.includes('queue'))   return 'warning';
    return 'secondary';
}

function formatDate(value: any): string {
    if (!value) return '—';
    try { return new Date(value).toLocaleString(); }
    catch { return String(value); }
}

const COLUMNS: ColumnDef<DownloadJobEventLD>[] = [
    {
        key: 'event',
        header: 'Event',
        width: 'w-40',
        render: row => {
            const name = String(row.event ?? '—');
            return <Badge variant={eventVariant(name)}>{name}</Badge>;
        },
    },
    {
        key: 'source',
        header: 'Source',
        width: 'w-32',
        render: row => (
            <span className="font-mono text-xs text-muted-foreground">{row.source ?? '—'}</span>
        ),
    },
    {
        key: 'worker',
        header: 'Worker',
        width: 'w-40',
        render: row => (
            <span className="font-mono text-xs text-muted-foreground truncate block max-w-40">
                {row.workerIdentifier ?? '—'}
            </span>
        ),
    },
    {
        key: 'message',
        header: 'Message',
        render: row => (
            <span className="text-sm">{row.updateMessage ?? row.exceptionMessage ?? '—'}</span>
        ),
    },
    {
        key: 'createdAt',
        header: 'Time',
        width: 'w-44',
        render: row => (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(row.createdAt)}
            </span>
        ),
    },
];

export function DownloadJobEventsPanel() {
    const [jobUuid,    setJobUuid]    = useState('');
    const [submitted,  setSubmitted]  = useState('');

    const fetcher = useCallback(
        (page: number, pageSize: number) => apiService.listDownloadJobEvents(submitted, page, pageSize),
        [submitted]
    );

    const paged = usePagedResource<DownloadJobEventLD>(fetcher, {
        enabled: !!submitted,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const uuid = jobUuid.trim();
        if (!uuid) return;
        setSubmitted(uuid);
        paged.setPage(1);
    };

    const uuidInput = (
        <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
                type="text"
                value={jobUuid}
                onChange={e => setJobUuid(e.target.value)}
                placeholder="Job UUID…"
                className="h-8 rounded-md border border-input bg-background px-3 text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-1
                           focus:ring-ring w-52"
            />
            <Button type="submit" size="sm" variant="outline" disabled={!jobUuid.trim()}>
                Load
            </Button>
        </form>
    );

    return (
        <ResourcePanel
            title="Download Job Events"
            description="Activity log for a specific download job"
            icon={<Activity className="w-5 h-5" />}
            columns={COLUMNS}
            rows={submitted ? paged.rows : null}
            status={submitted ? paged.status : 'idle'}
            error={paged.error}
            onReload={paged.reload}
            totalItems={submitted ? paged.totalItems : undefined}
            getRowKey={row => row['@id'] ?? row.id ?? Math.random()}
            headerAction={uuidInput}
            pagination={submitted ? (
                <Pagination
                    page={paged.page}
                    totalPages={paged.totalPages}
                    totalItems={paged.totalItems}
                    pageSize={paged.pageSize}
                    onPage={paged.setPage}
                    onPageSize={paged.setPageSize}
                    disabled={paged.status === 'loading'}
                />
            ) : undefined}
        />
    );
}
