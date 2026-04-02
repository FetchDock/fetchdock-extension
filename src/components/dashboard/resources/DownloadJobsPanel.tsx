import React, { useState } from 'react';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { ResourcePanel, type ColumnDef } from '@/components/dashboard/ResourcePanel';
import { usePagedResource } from '@/components/dashboard/useResource';
import { Pagination } from '@/components/dashboard/Pagination';
import { StateBadge, stateFromNumber } from '@/components/ui/state-badge';
import { Button } from '@/components/ui/button';
import { DownloadJobDetail } from '@/components/dashboard/resources/DownloadJobDetail';
import { apiService } from '@/service/apiService';

interface DownloadJobLD {
    '@id'?: string;
    uuid?: string;
    uri?: string;
    state?: number;
    downloader?: string;
    createdAt?: string;
    updatedAt?: string;
    message?: string;
}

function formatDate(value: any): string {
    if (!value) return '—';
    try { return new Date(value).toLocaleString(); }
    catch { return String(value); }
}

export function DownloadJobsPanel() {
    const [expandedUuid, setExpandedUuid] = useState<string | null>(null);

    const paged = usePagedResource<DownloadJobLD>(
        (page, pageSize) => apiService.listDownloadJobs(page, pageSize)
    );

    const toggle = (uuid: string) =>
        setExpandedUuid(prev => (prev === uuid ? null : uuid));

    const COLUMNS: ColumnDef<DownloadJobLD>[] = [
        {
            key: 'expand',
            header: '',
            width: 'w-10',
            render: row => {
                const uuid = row.uuid ?? '';
                const open = expandedUuid === uuid;
                return (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground"
                        onClick={() => toggle(uuid)}
                        title={open ? 'Collapse' : 'View details'}
                        disabled={!uuid}
                    >
                        {open
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                    </Button>
                );
            },
        },
        {
            key: 'uri',
            header: 'URI',
            render: row => (
                <span className="text-xs truncate block max-w-xs" title={row.uri}>
                    {row.uri ?? '—'}
                </span>
            ),
        },
        {
            key: 'state',
            header: 'Status',
            width: 'w-32',
            render: row => <StateBadge state={stateFromNumber(row.state)} />,
        },
        {
            key: 'createdAt',
            header: 'Created',
            width: 'w-44',
            render: row => (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(row.createdAt)}
                </span>
            ),
        },
    ];

    return (
        <ResourcePanel
            title="Download Jobs"
            description="All submitted download jobs"
            icon={<Download className="w-5 h-5" />}
            columns={COLUMNS}
            rows={paged.rows}
            status={paged.status}
            error={paged.error}
            onReload={paged.reload}
            totalItems={paged.totalItems}
            getRowKey={row => row.uuid ?? row['@id'] ?? Math.random()}
            expandedKey={expandedUuid ?? undefined}
            renderExpanded={row =>
                row.uuid ? (
                    <DownloadJobDetail
                        uuid={row.uuid}
                        onClose={() => setExpandedUuid(null)}
                    />
                ) : null
            }
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
