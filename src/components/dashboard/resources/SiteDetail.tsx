import React from 'react';
import { X, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useResource } from '@/components/dashboard/useResource';
import { DomainsCell } from '@/components/dashboard/resources/DownloadersPanel';
import { SiteOverridesEditor } from '@/components/settings/SiteOverridesEditor';
import { LocalSiteEditor } from '@/components/settings/LocalSiteEditor';
import { sendMessage } from '@/lib/messaging';
import { cn } from '@/lib/utils';
import type { LocalSiteSettings } from '@/lib/localSiteSettings';
import { type BaseLayer, type SiteRow, SourceBadge } from './siteRows';

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className={cn('flex flex-col gap-0.5', wide && 'col-span-2 md:col-span-3 xl:col-span-4')}>
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</dt>
            <dd className="text-sm break-all">{children}</dd>
        </div>
    );
}

function OnOff({ value }: { value: boolean | undefined }) {
    return value
        ? <Badge variant="success">On</Badge>
        : <Badge variant="muted">Off</Badge>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{children}</h4>;
}

function Note({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 mb-3">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{children}</span>
        </p>
    );
}

/** Expanded row of the Sites panel: site data, effective settings and the editor for the active settings mode. */
export function SiteDetail({ row, base, onClose, onServerOverrideChanged, onLocalChanged }: {
    row: SiteRow;
    base: BaseLayer;
    onClose: () => void;
    onServerOverrideChanged: () => void;
    onLocalChanged: (saved: LocalSiteSettings | null) => void;
}) {
    const slug = row.slug;

    const site = useResource(
        () => (slug ? sendMessage('getSite', slug) : Promise.resolve(null)),
    );

    // Effective values for this device (all server layers incl. this client); front pages resolve too.
    const probeUrl = row.domains[0] ? `https://${row.domains[0]}/` : null;
    const effective = useResource(
        () => (slug && probeUrl ? sendMessage('resolveSite', { url: probeUrl, force: true }) : Promise.resolve(null)),
    );

    const reload = () => { site.reload(); effective.reload(); };
    const loading = site.status === 'loading' || effective.status === 'loading';

    const extractors = site.data?.extractors ?? [];
    const downloaders = [...new Set(extractors.map(e => e.downloader).filter((d): d is string => !!d))];
    const resolution = effective.data;

    return (
        <div className="px-6 py-5 border-t border-dashed border-border/70">
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{row.name}</h3>
                    {slug && <span className="font-mono text-xs text-muted-foreground">{slug}</span>}
                    <SourceBadge source={row.source} />
                </div>
                <div className="flex items-center gap-1">
                    {slug && (
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={reload} disabled={loading} title="Refresh">
                            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Close">
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-4">
                <Field label="Status">
                    {row.enabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="destructive">Disabled</Badge>}
                </Field>
                {slug && (
                    <Field label="Effective downloader">
                        {effective.status === 'success'
                            ? <span className="font-mono text-xs">{resolution?.effectiveSettings?.downloader ?? '—'}</span>
                            : <div className="h-4 w-24 rounded bg-muted animate-pulse" />}
                    </Field>
                )}
                {slug && (
                    <Field label="Effective request context">
                        {effective.status === 'success' && resolution ? (
                            <span className="inline-flex flex-wrap gap-1 items-center text-xs">
                                Cookies <OnOff value={resolution.requestContext?.cookies} />
                                UA <OnOff value={resolution.requestContext?.userAgent} />
                                Referrer <OnOff value={resolution.requestContext?.referrer} />
                            </span>
                        ) : effective.status === 'success'
                            ? <span className="text-xs text-muted-foreground">Unavailable</span>
                            : <div className="h-4 w-40 rounded bg-muted animate-pulse" />}
                    </Field>
                )}
                <Field label="Domains" wide>
                    <DomainsCell domains={row.domains} />
                </Field>
                {slug && (
                    <Field label="Extractors" wide>
                        {site.status === 'error' && (
                            <span className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> {site.error}
                            </span>
                        )}
                        {site.status === 'success' && (
                            extractors.length === 0
                                ? <span className="text-xs text-muted-foreground">None</span>
                                : <div className="flex flex-wrap gap-1">
                                    {extractors.map(e => (
                                        <Badge key={`${e.downloader}:${e.key}`} variant="secondary" className="font-mono text-xs">
                                            {e.downloader} · {e.key}
                                        </Badge>
                                    ))}
                                </div>
                        )}
                        {(site.status === 'loading' || site.status === 'idle') && <div className="h-5 w-48 rounded bg-muted animate-pulse" />}
                    </Field>
                )}
            </dl>

            {/* Editor for the active settings mode */}
            <div className="mt-6">
                <SectionTitle>My settings for this site</SectionTitle>
                {base.serverMode && slug ? (
                    <>
                        <Note>
                            Stored on the server and shared with your other devices. "Inherit" uses your global settings;
                            this device's client settings still apply last.
                            {row.localOverride && ' This site also has local settings, which are only used while server settings are off.'}
                        </Note>
                        <SiteOverridesEditor slug={slug} downloaders={downloaders}
                                             effectiveDownloader={resolution?.effectiveSettings?.downloader}
                                             onChanged={() => { onServerOverrideChanged(); effective.reload(); }} />
                    </>
                ) : (
                    <>
                        <Note>
                            {base.serverMode
                                ? 'Local sites are only used while "Use my settings from the server" is off.'
                                : 'Stored only in this browser. "Inherit" uses the local toggles from the options page; the server can still restrict what is sent.'}
                        </Note>
                        <LocalSiteEditor key={row.key}
                                         site={{ slug: row.slug, name: row.name, domains: row.domains }}
                                         entry={row.localOverride}
                                         idPrefix={`local-${row.key}`}
                                         onChanged={onLocalChanged} />
                    </>
                )}
            </div>
        </div>
    );
}
