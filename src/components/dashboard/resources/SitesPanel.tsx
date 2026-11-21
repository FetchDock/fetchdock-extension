import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { ResourcePanel, type ColumnDef } from '@/components/dashboard/ResourcePanel';
import { usePagedResource, type HydraCollection } from '@/components/dashboard/useResource';
import { Pagination } from '@/components/dashboard/Pagination';
import { DomainsCell } from '@/components/dashboard/resources/DownloadersPanel';
import { SiteDetail } from '@/components/dashboard/resources/SiteDetail';
import { LocalSiteEditor } from '@/components/settings/LocalSiteEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendMessage } from '@/lib/messaging';
import { cn } from '@/lib/utils';
import optionsStorage from '@/utils/optionsStorage';
import { localSiteSettingsItem, type LocalSiteSettings } from '@/lib/localSiteSettings';
import type { Site, UserSettings, UserSiteSettings } from '@/api/schemas';
import {
    type BaseLayer,
    InheritedBadge,
    isCustomised,
    OriginLegend,
    type SettingKey,
    SettingValue,
    type SiteRow,
    siteRowFromLocal,
    siteRowFromServer,
    siteValue,
    SourceBadge,
} from './siteRows';

type View = 'all' | 'customised' | 'local';

const VIEWS: { value: View; label: string }[] = [
    { value: 'all', label: 'All sites' },
    { value: 'customised', label: 'Customised' },
    { value: 'local', label: 'Local only' },
];

const selectClass = cn(
    'h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground',
    'focus:outline-none focus:ring-1 focus:ring-ring',
);

function matchesSearch(row: Pick<SiteRow, 'name' | 'domains' | 'slug'>, search: string): boolean {
    const needle = search.trim().toLowerCase();
    return !needle || [row.name, row.slug ?? '', ...row.domains].some(t => t.toLowerCase().includes(needle));
}

function useDebounced<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

interface LocalConfig {
    serverMode: boolean;
    sendCookies: boolean;
    sendUserAgent: boolean;
    sendReferrer: boolean;
}

export function SitesPanel() {
    const [view, setView] = useState<View>('all');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounced(search);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);

    const [config, setConfig] = useState<LocalConfig | null>(null);
    const [globalLayer, setGlobalLayer] = useState<UserSettings | null>(null);
    const [overrides, setOverrides] = useState<Record<string, UserSiteSettings>>({});
    const [localSites, setLocalSites] = useState<Record<string, LocalSiteSettings>>({});
    const siteCache = useRef<Record<string, Site>>({});

    // ── Settings sources ────────────────────────────────────────────────────
    useEffect(() => {
        const apply = (opts: Awaited<ReturnType<typeof optionsStorage.getAll>>) => setConfig({
            serverMode: !!opts.useServerSettings && !!opts.oauth2AccessToken,
            sendCookies: opts.sendCookies,
            sendUserAgent: opts.sendUserAgent,
            sendReferrer: opts.sendReferrer,
        });
        optionsStorage.getAll().then(apply);
        optionsStorage.onChanged(apply);

        localSiteSettingsItem.getValue().then(setLocalSites);
        return localSiteSettingsItem.watch(setLocalSites);
    }, []);

    const loadOverrides = useCallback(() => {
        sendMessage('listUserSiteSettings', undefined)
            .then(list => setOverrides(Object.fromEntries(list.filter(o => o.slug).map(o => [o.slug!, o]))))
            .catch(err => console.warn('[SitesPanel] Loading site overrides failed', err));
    }, []);

    useEffect(loadOverrides, [loadOverrides]);

    useEffect(() => {
        if (!config?.serverMode) return;
        sendMessage('getUserSettings', undefined)
            .then(setGlobalLayer)
            .catch(err => console.warn('[SitesPanel] Loading global settings failed', err));
    }, [config?.serverMode]);

    const base: BaseLayer = useMemo(() => config?.serverMode
        ? {
            serverMode: true,
            sendCookies: globalLayer?.sendCookies ?? null,
            sendUserAgent: globalLayer?.sendUserAgent ?? null,
            sendReferrer: globalLayer?.sendReferrer ?? null,
            downloader: globalLayer?.preferredDownloader ?? null,
            label: 'your global server settings',
        }
        : {
            serverMode: false,
            sendCookies: config?.sendCookies ?? null,
            sendUserAgent: config?.sendUserAgent ?? null,
            sendReferrer: config?.sendReferrer ?? null,
            downloader: null,
            label: 'the local toggles in the options',
        }, [config, globalLayer]);

    // ── Rows ────────────────────────────────────────────────────────────────
    const getSite = useCallback(async (slug: string): Promise<Site | null> => {
        if (!siteCache.current[slug]) {
            try {
                siteCache.current[slug] = await sendMessage('getSite', slug);
            } catch {
                return null;
            }
        }
        return siteCache.current[slug];
    }, []);

    /** Server sites for the given slugs, falling back to the stored names/domains when the server doesn't know them. */
    const rowsForSlugs = useCallback(async (slugs: string[]): Promise<SiteRow[]> => {
        const rows = await Promise.all(slugs.map(async slug => {
            const site = await getSite(slug);
            if (site) return siteRowFromServer(site);
            const local = localSites[slug];
            return { key: slug, slug, name: overrides[slug]?.name ?? local?.name ?? slug, domains: local?.domains ?? [], enabled: false, source: 'auto' as const };
        }));
        return rows.sort((a, b) => a.name.localeCompare(b.name));
    }, [getSite, localSites, overrides]);

    const localOnlyRows = useCallback((): SiteRow[] =>
        Object.entries(localSites)
            .filter(([, entry]) => entry.slug === null)
            .map(([key, entry]) => siteRowFromLocal(key, entry))
            .sort((a, b) => a.name.localeCompare(b.name)), [localSites]);

    const fetcher = async (page: number, pageSize: number): Promise<HydraCollection<SiteRow>> => {
        const locals = localOnlyRows().filter(r => matchesSearch(r, debouncedSearch));

        if (view === 'all') {
            const result = await sendMessage('listSites', { page, itemsPerPage: pageSize, search: debouncedSearch || undefined });
            const serverRows = result.member.map(siteRowFromServer);
            // Extension-only sites are listed first, on the first page
            return { member: page === 1 ? [...locals, ...serverRows] : serverRows, totalItems: result.totalItems + locals.length };
        }

        const slugs = view === 'customised'
            ? [...new Set([...Object.keys(overrides), ...Object.values(localSites).map(e => e.slug).filter((s): s is string => !!s)])]
            : Object.values(localSites).map(e => e.slug).filter((s): s is string => !!s);
        const rows = [...locals, ...(await rowsForSlugs(slugs)).filter(r => matchesSearch(r, debouncedSearch))];
        return { member: rows.slice((page - 1) * pageSize, page * pageSize), totalItems: rows.length };
    };

    const paged = usePagedResource<SiteRow>(fetcher, { enabled: config !== null, initialPageSize: 25 });

    // Refetch from page 1 when the query changes (not on mount: the hook loads by itself)
    const mounted = useRef(false);
    const membershipKey = view === 'all'
        ? JSON.stringify(Object.keys(localSites))
        : JSON.stringify([Object.keys(overrides), Object.keys(localSites)]);
    useEffect(() => {
        if (!mounted.current) { mounted.current = true; return; }
        paged.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, debouncedSearch, membershipKey]);

    // Overrides change more often than the list: merge them at render time
    const rows = useMemo(() => paged.rows.map(row => ({
        ...row,
        serverOverride: row.slug ? overrides[row.slug] : undefined,
        localOverride: localSites[row.key] ?? row.localOverride,
    })), [paged.rows, overrides, localSites]);

    const toggle = (key: string) => setExpandedKey(prev => (prev === key ? null : key));

    const settingColumn = (key: SettingKey, header: string, baseValue: boolean | null): ColumnDef<SiteRow> => ({
        key,
        header,
        width: 'w-28',
        render: row => <SettingValue own={siteValue(row, base, key)} inherited={baseValue} inheritedFrom={base.label} />,
    });

    const COLUMNS: ColumnDef<SiteRow>[] = [
        {
            key: 'expand',
            header: '',
            width: 'w-10',
            render: row => {
                const open = expandedKey === row.key;
                return (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"
                            onClick={() => toggle(row.key)} title={open ? 'Collapse' : 'View details'}>
                        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                );
            },
        },
        {
            key: 'site',
            header: 'Site',
            render: row => (
                <div className="flex flex-col gap-1">
                    <span className="font-medium flex items-center gap-1.5">
                        {row.name}
                        {isCustomised(row, base) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Has settings for this site" />
                        )}
                    </span>
                    <span className="flex items-center gap-1.5">
                        {row.slug && <span className="font-mono text-xs text-muted-foreground">{row.slug}</span>}
                        <SourceCell row={row} serverMode={base.serverMode} />
                    </span>
                </div>
            ),
        },
        {
            key: 'domains',
            header: 'Domains',
            render: row => <DomainsCell domains={row.domains} />,
        },
        settingColumn('sendCookies', 'Cookies', base.sendCookies),
        settingColumn('sendUserAgent', 'User-Agent', base.sendUserAgent),
        settingColumn('sendReferrer', 'Referrer', base.sendReferrer),
        {
            key: 'downloader',
            header: 'Downloader',
            width: 'w-36',
            render: row => {
                if (!base.serverMode) {
                    return <InheritedBadge title="Chosen by the server">Server</InheritedBadge>;
                }
                const own = row.serverOverride?.downloader;
                if (own) {
                    return <Badge variant="secondary" className="font-mono text-xs" title="Set for this site">{own}</Badge>;
                }
                return (
                    <InheritedBadge title={`Inherited from ${base.label}`} className={cn(base.downloader && 'font-mono text-xs')}>
                        {base.downloader ?? 'Automatic'}
                    </InheritedBadge>
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

    const headerAction = (
        <div className="flex items-center gap-2">
            <Input type="search" placeholder="Search name or domain" value={search}
                   onChange={e => setSearch(e.target.value)} className="h-8 w-48" />
            <select className={selectClass} value={view} onChange={e => setView(e.target.value as View)} title="Show">
                {VIEWS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
            <Button variant="outline" size="sm" className="h-8 mt-0" onClick={() => setAdding(a => !a)}>
                <Plus className="w-4 h-4" /> Local site
            </Button>
        </div>
    );

    return (
        <div className="space-y-4">
            {adding && (
                <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-sm font-semibold">New local site</h3>
                            <p className="text-xs text-muted-foreground">
                                Stored only in this browser and used while "Use my settings from the server" is off.
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAdding(false)} title="Close">
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    <LocalSiteEditor site={{ slug: null, name: '', domains: [] }} entry={null} idPrefix="new-local-site"
                                     onChanged={saved => { if (saved) setAdding(false); }} />
                </div>
            )}

            <ResourcePanel
                title="Sites"
                description={base.serverMode
                    ? 'Sites known to the server and your site settings (server settings mode)'
                    : 'Sites known to the server and your local site settings (local settings mode)'}
                icon={<Globe className="w-5 h-5" />}
                columns={COLUMNS}
                rows={rows}
                status={paged.status}
                error={paged.error}
                onReload={() => { siteCache.current = {}; loadOverrides(); paged.reload(); }}
                totalItems={paged.totalItems}
                getRowKey={row => row.key}
                headerAction={headerAction}
                expandedKey={expandedKey}
                renderExpanded={row => (
                    <SiteDetail
                        row={row}
                        base={base}
                        onClose={() => setExpandedKey(null)}
                        onServerOverrideChanged={loadOverrides}
                        onLocalChanged={saved => { if (!saved && row.source === 'local') setExpandedKey(null); }}
                    />
                )}
                pagination={
                    <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-xs text-muted-foreground"><OriginLegend /></span>
                        <Pagination
                            page={paged.page}
                            totalPages={paged.totalPages}
                            totalItems={paged.totalItems}
                            pageSize={paged.pageSize}
                            onPage={paged.setPage}
                            onPageSize={paged.setPageSize}
                            disabled={paged.status === 'loading'}
                        />
                    </div>
                }
            />
        </div>
    );
}

function SourceCell({ row, serverMode }: { row: SiteRow; serverMode: boolean }) {
    return (
        <span className="inline-flex items-center gap-1">
            <SourceBadge source={row.source} />
            {row.source !== 'local' && row.localOverride && (
                <Badge variant="warning" className={cn(serverMode && 'opacity-60')}
                       title={serverMode ? 'Has local settings (unused while server settings are on)' : 'Has local settings'}>
                    Local
                </Badge>
            )}
        </span>
    );
}
