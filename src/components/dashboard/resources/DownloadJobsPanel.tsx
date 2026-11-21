import React, { useEffect, useState } from 'react';
import { Download, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { ResourcePanel, type ColumnDef } from '@/components/dashboard/ResourcePanel';
import { usePagedResource } from '@/components/dashboard/useResource';
import { Pagination } from '@/components/dashboard/Pagination';
import { StateBadge, stateFromNumber } from '@/components/ui/state-badge';
import { Button } from '@/components/ui/button';
import { DownloadJobDetail } from '@/components/dashboard/resources/DownloadJobDetail';
import { DeleteDownloadJobDialog } from '@/components/dashboard/resources/DeleteDownloadJobDialog';
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

    const [pendingDelete, setPendingDelete] = useState<{ uuid: string; uri?: string } | null>(null);
    /** Deleted jobs, hidden right away until the reload confirms it */
    const [deletedUuids, setDeletedUuids] = useState<Set<string>>(new Set());

    const toggle = (uuid: string) =>
        setExpandedUuid(prev => (prev === uuid ? null : uuid));

    const handleDeleted = (uuid: string) => {
        setDeletedUuids(prev => new Set(prev).add(uuid));
        setExpandedUuid(prev => (prev === uuid ? null : prev));
        paged.reload();
    };

    const rows = paged.rows.filter(row => !row.uuid || !deletedUuids.has(row.uuid));

    // Deleting the last job of a page: go back a page
    useEffect(() => {
        if (paged.status === 'success' && paged.rows.length === 0 && paged.page > 1) {
            paged.setPage(paged.page - 1);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paged.status, paged.rows.length, paged.page]);

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
        {
            key: 'actions',
            header: '',
            width: 'w-12',
            render: row => (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => row.uuid && setPendingDelete({ uuid: row.uuid, uri: row.uri })}
                    title="Delete job"
                    disabled={!row.uuid}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            ),
        },
    ];

    return (
        <>
        <ResourcePanel
            title="Download Jobs"
            description="All submitted download jobs"
            icon={<Download className="w-5 h-5" />}
            columns={COLUMNS}
            rows={rows}
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
                        onDelete={setPendingDelete}
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
        <DeleteDownloadJobDialog
            job={pendingDelete}
            onClose={() => setPendingDelete(null)}
            onDeleted={handleDeleted}
        />
        </>
    );
}
