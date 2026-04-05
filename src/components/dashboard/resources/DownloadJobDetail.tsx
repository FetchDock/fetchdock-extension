import React from 'react';
import { X, ExternalLink, Copy, Check, RefreshCw, AlertCircle, DownloadIcon } from 'lucide-react';
import optionsStorage from '@/utils/optionsStorage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StateBadge, stateFromNumber } from '@/components/ui/state-badge';
import { useResource } from '@/components/dashboard/useResource';
import { usePagedResource } from '@/components/dashboard/useResource';
import { Pagination } from '@/components/dashboard/Pagination';
import { apiService } from '@/service/apiService';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DownloadJobFull {
    '@id'?: string;
    uuid?: string;
    uri?: string;
    state?: number;
    downloader?: string;
    jobType?: { name?: string } | string;
    message?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
}

interface DownloadJobEventLD {
    '@id'?: string;
    id?: any;
    event?: string;
    source?: string;
    workerIdentifier?: string;
    context?: any;
    updateMessage?: string;
    exceptionMessage?: string;
    createdAt?: string;
}

interface DownloadJobFileLD {
    '@id'?: string;
    id?: any;
    filename?: string;
    downloadUri?: string;
}

// ─── Small helpers ────────────────────────────────────────────────────────────


function fmtDate(value: any): string {
    if (!value) return '—';
    try { return new Date(value).toLocaleString(); }
    catch { return String(value); }
}

function Field({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</dt>
            <dd className={cn('text-sm break-all', mono && 'font-mono text-xs')}>{children}</dd>
        </div>
    );
}

function eventVariant(event: string): 'success' | 'destructive' | 'warning' | 'secondary' {
    const e = event.toLowerCase();
    if (e.includes('complet') || e.includes('success') || e.includes('finish')) return 'success';
    if (e.includes('fail') || e.includes('error') || e.includes('abort'))       return 'destructive';
    if (e.includes('start') || e.includes('progress') || e.includes('queue'))   return 'warning';
    return 'secondary';
}

// ─── Copy-to-clipboard mini-button ───────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = React.useState(false);
    return (
        <button
            type="button"
            onClick={() => {
                navigator.clipboard?.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                });
            }}
            className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
            title="Copy"
        >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
    );
}

// ─── Embedded events mini-table ───────────────────────────────────────────────

const EVENTS_PAGE_SIZE = 10;

function EventsTable({ uuid }: { uuid: string }) {
    const paged = usePagedResource<DownloadJobEventLD>(
        (page, pageSize) => apiService.listDownloadJobEvents(uuid, page, pageSize),
        { initialPageSize: EVENTS_PAGE_SIZE }
    );

    return (
        <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Events
                    {paged.status === 'success' && paged.totalItems > 0 && (
                        <span className="ml-1.5 font-normal">({paged.totalItems})</span>
                    )}
                </h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={paged.reload}
                    disabled={paged.status === 'loading'} title="Refresh events">
                    <RefreshCw className={cn('w-3 h-3', paged.status === 'loading' && 'animate-spin')} />
                </Button>
            </div>

            {paged.status === 'error' && (
                <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {paged.error}
                </p>
            )}

            {(paged.status === 'loading' || paged.status === 'idle') && (
                <div className="space-y-1.5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-7 rounded bg-muted animate-pulse" />
                    ))}
                </div>
            )}

            {paged.status === 'success' && paged.rows.length === 0 && (
                <p className="text-xs text-muted-foreground">No events yet.</p>
            )}

            {paged.status === 'success' && paged.rows.length > 0 && (
                <>
                    <div className="rounded-md border border-border overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                            <tr className="bg-muted/40 border-b border-border">
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-36">Event</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-28">Source</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-40">Message</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">Context</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-40">Time</th>
                            </tr>
                            </thead>
                            <tbody>
                            {paged.rows.map((ev, i) => (
                                <tr key={ev['@id'] ?? ev.id ?? i}
                                    className="border-b border-border last:border-0 hover:bg-muted/20">
                                    <td className="px-3 py-2">
                                        <Badge variant={eventVariant(String(ev.event ?? ''))} className="text-[10px]">
                                            {ev.event ?? '—'}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-muted-foreground">{ev.source ?? '—'}</td>
                                    <td className="px-3 py-2">{ev.updateMessage ?? ev.exceptionMessage ?? '—'}</td>
                                    <td className="px-3 py-2 font-mono text-muted-foreground">
                                        <pre className="whitespace-pre-wrap overflow-auto">
                                            {ev.context
                                                ? JSON.stringify(ev.context, null, '\t')
                                                    .replace(/\\n/g, '\n')
                                                    .replace(/\\t/g, '\t')
                                                : '—'
                                            }
                                        </pre>
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                        {fmtDate(ev.createdAt)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {paged.totalPages > 1 && (
                        <div className="mt-2 flex justify-end">
                            <Pagination
                                page={paged.page}
                                totalPages={paged.totalPages}
                                totalItems={paged.totalItems}
                                pageSize={paged.pageSize}
                                onPage={paged.setPage}
                                onPageSize={paged.setPageSize}
                                disabled={paged.status !== 'success'}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}


// ─── Embedded files mini-table ───────────────────────────────────────────────

const FILES_PAGE_SIZE = 10;

function FileActionButtons({ file, host }: { file: DownloadJobFileLD; host: string }) {
    const absoluteUrl = React.useMemo(() => {
        if (!file.downloadUri) return '';
        // If the URI is already absolute (e.g. starts with http), use it as-is.
        if (/^https?:\/\//i.test(file.downloadUri)) return file.downloadUri;
        const base = host.replace(/\/+$/, '');
        const path = file.downloadUri.startsWith('/') ? file.downloadUri : `/${file.downloadUri}`;
        return `${base}${path}`;
    }, [file.downloadUri, host]);

    const handleDownload = () => {
        if (absoluteUrl) window.open(absoluteUrl, '_blank');
    };

    return (
        <div className="flex items-center gap-1">
            <Button
                title={absoluteUrl || 'No download URL available'}
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                disabled={!absoluteUrl}
            >
                <DownloadIcon />
            </Button>
        </div>
    );
}

function FilesTable({ uuid }: { uuid: string }) {
    const pagedDownloads = usePagedResource<DownloadJobFileLD>(
        (page, pageSize) => apiService.listDownloadedFiles(uuid, page, pageSize),
        { initialPageSize: FILES_PAGE_SIZE }
    );

    const [host, setHost] = React.useState('');
    React.useEffect(() => {
        optionsStorage.getAll().then(opts => {
            setHost((opts.downloadRouterServerHost ?? '').replace(/\/+$/, ''));
        });
    }, []);

    return (
        <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Files
                    {pagedDownloads.status === 'success' && pagedDownloads.totalItems > 0 && (
                        <span className="ml-1.5 font-normal">({pagedDownloads.totalItems})</span>
                    )}
                </h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={pagedDownloads.reload}
                        disabled={pagedDownloads.status === 'loading'} title="Refresh files">
                    <RefreshCw className={cn('w-3 h-3', pagedDownloads.status === 'loading' && 'animate-spin')} />
                </Button>
            </div>

            {pagedDownloads.status === 'error' && (
                <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {pagedDownloads.error}
                </p>
            )}

            {(pagedDownloads.status === 'loading' || pagedDownloads.status === 'idle') && (
                <div className="space-y-1.5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-7 rounded bg-muted animate-pulse" />
                    ))}
                </div>
            )}

            {pagedDownloads.status === 'success' && pagedDownloads.rows.length === 0 && (
                <p className="text-xs text-muted-foreground">No files yet.</p>
            )}

            {pagedDownloads.status === 'success' && pagedDownloads.rows.length > 0 && (
                <>
                    <div className="rounded-md border border-border overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                            <tr className="bg-muted/40 border-b border-border">
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-36">File</th>
                                {/*<th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-28">Size</th>*/}
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide w-40">Download URI</th>
                            </tr>
                            </thead>
                            <tbody>
                            {pagedDownloads.rows.map((file) => (
                                <tr key={file['@id'] ?? file.id}>
                                    <td>
                                        <FileActionButtons file={file} host={host} />
                                    </td>
                                    <td className="px-3 py-2">{file.filename}</td>
                                    {/*<td className="px-3 py-2">{file.size} bytes</td>*/}
                                    <td className="px-3 py-2">{file.downloadUri}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>



                    {pagedDownloads.totalPages > 1 && (
                        <div className="mt-2 flex justify-end">
                            <Pagination
                                page={pagedDownloads.page}
                                totalPages={pagedDownloads.totalPages}
                                totalItems={pagedDownloads.totalItems}
                                pageSize={pagedDownloads.pageSize}
                                onPage={pagedDownloads.setPage}
                                onPageSize={pagedDownloads.setPageSize}
                                disabled={pagedDownloads.status !== 'success'}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Main detail panel ────────────────────────────────────────────────────────

interface DownloadJobDetailProps {
    uuid: string;
    onClose: () => void;
}

export function DownloadJobDetail({ uuid, onClose }: DownloadJobDetailProps) {
    const { data, status, error, reload } = useResource<DownloadJobFull>(
        () => apiService.getDownloadJob(uuid)
    );

    const job = data as DownloadJobFull | null;

    const downloaderLabel = (() => {
        if (!job?.downloader) return '—';
        return String(job.downloader).split('/').at(-1) ?? String(job.downloader);
    })();

    return (
        <div className="px-6 py-5 border-t border-dashed border-border/70">
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Job Detail</h3>
                    <span className="font-mono text-xs text-muted-foreground">{uuid}</span>
                    <CopyButton text={uuid} />
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={reload} disabled={status === 'loading'} title="Refresh">
                        <RefreshCw className={cn('w-3.5 h-3.5', status === 'loading' && 'animate-spin')} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={onClose} title="Close">
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Loading */}
            {(status === 'loading' || status === 'idle') && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="space-y-1.5">
                            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                            <div className="h-4 rounded bg-muted animate-pulse" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {status === 'error' && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
                </div>
            )}

            {/* Data */}
            {status === 'success' && job && (
                <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Status">
                        <StateBadge state={stateFromNumber(job.state)} />
                    </Field>
                    <Field label="Downloader">
                        <span className="font-mono text-xs">{downloaderLabel}</span>
                    </Field>
                    <Field label="Created">
                        <span>{fmtDate(job.createdAt)}</span>
                    </Field>
                    <Field label="Updated">
                        <span>{fmtDate(job.updatedAt)}</span>
                    </Field>

                    {/* URI spans full width */}
                    <div className="col-span-2 md:col-span-3 xl:col-span-4 flex flex-col gap-0.5">
                        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URI</dt>
                        <dd className="text-sm font-mono break-all flex items-start gap-1">
                            <span>{job.uri ?? '—'}</span>
                            {job.uri && (
                                <>
                                    <CopyButton text={job.uri} />
                                    <a href={job.uri} target="_blank" rel="noreferrer"
                                        className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                        title="Open URI">
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </>
                            )}
                        </dd>
                    </div>

                    {job.message && (
                        <div className="col-span-2 md:col-span-3 xl:col-span-4 flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message</dt>
                            <dd className="text-sm">{job.message}</dd>
                        </div>
                    )}
                </dl>
            )}

            {uuid && <FilesTable uuid={uuid} />}

            {/* Events — only mount once we have the UUID and the detail loaded */}
            {uuid && <EventsTable uuid={uuid} />}
        </div>
    );
}

