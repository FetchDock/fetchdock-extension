import React, { useState } from 'react';
import { HardDrive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ResourcePanel, type ColumnDef } from '@/components/dashboard/ResourcePanel';
import { usePagedResource } from '@/components/dashboard/useResource';
import { Pagination } from '@/components/dashboard/Pagination';
import { apiService } from '@/service/apiService';

// With JSON-LD, nested relations become IRI strings — keep the shape flexible
interface DownloaderLD {
    '@id'?: string;
    id?: any;
    enabled?: any;
    downloaderType?: { name?: string } | string;
    supportedDomains?: any;
}

const VISIBLE_DOMAINS = 5;

function DomainsCell({ domains }: { domains: string[] }) {
    const [expanded, setExpanded] = useState(false);

    if (domains.length === 0)
        return <span className="text-muted-foreground text-xs">None</span>;

    const visible = expanded ? domains : domains.slice(0, VISIBLE_DOMAINS);
    const overflow = domains.length - VISIBLE_DOMAINS;

    return (
        <div className="flex flex-wrap gap-1">
            {visible.map(d => (
                <Badge key={d} variant="secondary" className="font-mono text-xs">{d}</Badge>
            ))}
            {!expanded && overflow > 0 && (
                <Badge
                    variant="muted"
                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setExpanded(true)}
                    title="Show all domains"
                >
                    +{overflow}
                </Badge>
            )}
            {expanded && (
                <Badge
                    variant="muted"
                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setExpanded(false)}
                    title="Show fewer"
                >
                    Show less
                </Badge>
            )}
        </div>
    );
}

const COLUMNS: ColumnDef<DownloaderLD>[] = [
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
        render: row => {
            const t = row.downloaderType;
            const name = typeof t === 'object' ? t?.name : t;
            return <span className="font-medium">{name ?? '—'}</span>;
        },
    },
    {
        key: 'domains',
        header: 'Supported Domains',
        render: row => {
            const domains: string[] = Array.isArray(row.supportedDomains) ? row.supportedDomains : [];
            return <DomainsCell domains={domains} />;
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
    const paged = usePagedResource<DownloaderLD>(
        (page, pageSize) => apiService.listDownloaders(page, pageSize)
    );

    return (
        <ResourcePanel
            title="Downloaders"
            description="Configured downloader backends"
            icon={<HardDrive className="w-5 h-5" />}
            columns={COLUMNS}
            rows={paged.rows}
            status={paged.status}
            error={paged.error}
            onReload={paged.reload}
            totalItems={paged.totalItems}
            getRowKey={row => row['@id'] ?? row.id ?? Math.random()}
            pagination={
                <Pagination
                    page={paged.page}
                    totalPages={paged.totalPages}
                    totalItems={paged.totalItems}
                    pageSize={paged.pageSize}
                    onPage={paged.setPage}
                    onPageSize={paged.setPageSize}
                    disabled={paged.status === 'loading'}
                />
            }
        />
    );
}
