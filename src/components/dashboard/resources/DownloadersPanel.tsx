import React from 'react';
import { HardDrive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ResourcePanel, type ColumnDef } from '@/components/dashboard/ResourcePanel';
import { useResource } from '@/components/dashboard/useResource';
import { apiService } from '@/service/apiService';
import type { Downloader } from '@/service/api';

const COLUMNS: ColumnDef<Downloader>[] = [
    {
        key: 'id',
        header: 'ID',
        width: 'w-24',
        render: row => (
            <span className="font-mono text-xs text-muted-foreground">{row.id ?? '—'}</span>
        ),
    },
    {
        key: 'type',
        header: 'Type',
        render: row => (
            <span className="font-medium">{row.downloaderType?.name ?? '—'}</span>
        ),
    },
    {
        key: 'domains',
        header: 'Supported Domains',
        render: row => {
            const domains: string[] = Array.isArray(row.supportedDomains)
                ? row.supportedDomains
                : [];
            if (domains.length === 0) return <span className="text-muted-foreground text-xs">None</span>;
            return (
                <div className="flex flex-wrap gap-1">
                    {domains.slice(0, 5).map(d => (
                        <Badge key={d} variant="secondary" className="font-mono text-xs">{d}</Badge>
                    ))}
                    {domains.length > 5 && (
                        <Badge variant="muted">+{domains.length - 5}</Badge>
                    )}
                </div>
            );
        },
    },
    {
        key: 'enabled',
        header: 'Status',
        width: 'w-24',
        render: row => row.enabled
            ? <Badge variant="success">Enabled</Badge>
            : <Badge variant="destructive">Disabled</Badge>,
    },
];

export function DownloadersPanel() {
    const { data, status, error, reload } = useResource(
        () => apiService.listDownloaders().then((res: any) => res?.member ?? res ?? [])
    );

    return (
        <ResourcePanel
            title="Downloaders"
            description="Configured downloader backends"
            icon={<HardDrive className="w-5 h-5" />}
            columns={COLUMNS}
            rows={data as Downloader[] | null}
            status={status}
            error={error}
            onReload={reload}
            getRowKey={row => row.id ?? Math.random()}
        />
    );
}

