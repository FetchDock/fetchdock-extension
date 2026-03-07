import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResourcePanel, type ColumnDef } from '@/components/dashboard/ResourcePanel';
import { useResource } from '@/components/dashboard/useResource';
import { apiService } from '@/service/apiService';
import type { DownloadJobEvent } from '@/service/api';

function eventVariant(event: string): 'success' | 'destructive' | 'warning' | 'secondary' {
    const e = String(event).toLowerCase();
    if (e.includes('complet') || e.includes('success') || e.includes('finish')) return 'success';
    if (e.includes('fail') || e.includes('error') || e.includes('abort'))       return 'destructive';
    if (e.includes('start') || e.includes('progress') || e.includes('queue'))   return 'warning';
    return 'secondary';
}

function formatDate(value: any): string {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return String(value);
    }
}

const COLUMNS: ColumnDef<DownloadJobEvent>[] = [
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
    const [jobUuid, setJobUuid]   = useState('');
    const [submitted, setSubmitted] = useState('');

    const { data, status, error, reload } = useResource(
        () => apiService
            .listDownloadJobEvents(submitted)
            .then((res: any) => res?.member ?? res ?? []),
        { enabled: !!submitted }
    );

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (jobUuid.trim()) {
            setSubmitted(jobUuid.trim());
        }
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
            rows={submitted ? (data as DownloadJobEvent[] | null) : null}
            status={submitted ? status : 'idle'}
            error={error}
            onReload={reload}
            getRowKey={row => row.id ?? Math.random()}
            headerAction={uuidInput}
        />
    );
}

