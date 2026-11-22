import React from 'react';
import { i18n } from '#imports';
import { Flag, Loader2, Undo2 } from 'lucide-react';
import { ResourcePanel, type ColumnDef } from '@/components/dashboard/ResourcePanel';
import { usePagedResource } from '@/components/dashboard/useResource';
import { Pagination } from '@/components/dashboard/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { sendMessage } from '@/lib/messaging';
import type { FailureReport } from '@/api/schemas';

function formatDate(value: string | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusVariant(status: FailureReport['status']): 'success' | 'secondary' | 'warning' | 'destructive' {
    switch (status) {
        case 'resolved': return 'success';
        case 'acknowledged': return 'warning';
        case 'wont_fix': return 'destructive';
        default: return 'secondary';
    }
}

/** The user's own failure reports (GET /users/failure_reports) with withdraw. */
export function FailureReportsPanel() {
    const paged = usePagedResource<FailureReport>(
        (page, itemsPerPage) => sendMessage('listFailureReports', { page, itemsPerPage }),
    );
    const [withdrawing, setWithdrawing] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const withdraw = async (report: FailureReport) => {
        if (!report.id || !window.confirm(i18n.t('report.list.withdrawConfirm'))) return;
        setWithdrawing(report.id);
        setError(null);
        try {
            await sendMessage('withdrawFailureReport', report.id);
            paged.reload();
        } catch (err) {
            setError(i18n.t('report.list.withdrawFailed', [err instanceof Error ? err.message : String(err)]));
        } finally {
            setWithdrawing(null);
        }
    };

    const columns: ColumnDef<FailureReport>[] = [
        {
            key: 'url',
            header: i18n.t('report.list.columns.url'),
            render: (row) => (
                <div className="min-w-0">
                    <span className="text-xs truncate block max-w-md" title={row.url}>{row.url}</span>
                    {row.comment && <span className="text-xs text-muted-foreground truncate block max-w-md" title={row.comment}>{row.comment}</span>}
                </div>
            ),
        },
        {
            key: 'kind',
            header: i18n.t('report.list.columns.kind'),
            width: 'w-36',
            render: (row) => <span className="text-xs">{i18n.t(`report.kinds.${row.kind}`)}</span>,
        },
        {
            key: 'status',
            header: i18n.t('report.list.columns.status'),
            width: 'w-32',
            render: (row) => row.status
                ? <Badge variant={statusVariant(row.status)}>{i18n.t(`report.status.${row.status}`)}</Badge>
                : '—',
        },
        {
            key: 'createdAt',
            header: i18n.t('report.list.columns.created'),
            width: 'w-44',
            render: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.createdAt)}</span>,
        },
        {
            key: 'actions',
            header: '',
            width: 'w-12',
            render: (row) => (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => withdraw(row)} disabled={!row.id || withdrawing !== null}
                        title={i18n.t('report.list.withdraw')}>
                    {withdrawing === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <ResourcePanel
                title={i18n.t('report.list.title')}
                description={i18n.t('report.list.description')}
                icon={<Flag className="w-5 h-5" />}
                columns={columns}
                rows={paged.rows}
                status={paged.status}
                error={paged.error}
                onReload={paged.reload}
                totalItems={paged.totalItems}
                getRowKey={(row) => row.id ?? row.url}
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
        </div>
    );
}
