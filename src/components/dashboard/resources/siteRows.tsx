import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Site, UserSiteSettings } from '@/api/schemas';
import type { LocalSiteSettings } from '@/lib/localSiteSettings';

export type SiteSource = 'curated' | 'auto' | 'local';

/** One row of the Sites panel: a server site and/or a local entry, with the user's overrides. */
export interface SiteRow {
    /** Server slug, or the local key for extension-only sites */
    key: string;
    slug: string | null;
    name: string;
    domains: string[];
    enabled: boolean;
    source: SiteSource;
    serverOverride?: UserSiteSettings;
    localOverride?: LocalSiteSettings;
}

/** The layer a site setting inherits from when the site doesn't define it. */
export interface BaseLayer {
    /** true: server settings (global layer + server site overrides); false: local toggles + local site settings */
    serverMode: boolean;
    sendCookies: boolean | null;
    sendUserAgent: boolean | null;
    sendReferrer: boolean | null;
    downloader: string | null;
    /** Where inherited values come from, for tooltips */
    label: string;
}

export type SettingKey = 'sendCookies' | 'sendUserAgent' | 'sendReferrer';

export function siteRowFromServer(site: Site): SiteRow {
    return {
        key: site.slug ?? '',
        slug: site.slug ?? null,
        name: site.name ?? site.slug ?? '',
        domains: site.domains ?? [],
        enabled: site.enabled,
        source: site.curated ? 'curated' : 'auto',
    };
}

/** Row for an extension-only site (server sites are built from the server data and merged with their local entry). */
export function siteRowFromLocal(key: string, entry: LocalSiteSettings): SiteRow {
    return {
        key,
        slug: entry.slug,
        name: entry.name,
        domains: entry.domains,
        enabled: true,
        source: 'local',
        localOverride: entry,
    };
}

/** The site's own value for the active mode (undefined/null = inherited). */
export function siteValue(row: SiteRow, base: BaseLayer, key: SettingKey): boolean | null {
    const layer = base.serverMode ? row.serverOverride : row.localOverride;
    return layer?.[key] ?? null;
}

export function isCustomised(row: SiteRow, base: BaseLayer): boolean {
    if (!base.serverMode) {
        return !!row.localOverride;
    }
    const o = row.serverOverride;
    return !!o && (o.sendCookies != null || o.sendUserAgent != null || o.sendReferrer != null
        || o.downloader != null || Object.keys(o.downloaderOptions ?? {}).length > 0);
}

export function SourceBadge({ source }: { source: SiteSource }) {
    switch (source) {
        case 'curated':
            return <Badge variant="secondary" title="Defined in the server's curated site list">Curated</Badge>;
        case 'auto':
            return <Badge variant="muted" title="Created automatically by the server for an unmapped extractor">Automatic</Badge>;
        case 'local':
            return <Badge variant="warning" title="Defined only in this browser">Local</Badge>;
    }
}

/**
 * A setting value, styled by origin: solid = set for this site, dashed/muted = inherited.
 */
export function SettingValue({ own, inherited, inheritedFrom, labels = ['On', 'Off'] }: {
    own: boolean | null;
    inherited: boolean | null;
    inheritedFrom: string;
    labels?: [string, string];
}) {
    if (own != null) {
        return (
            <Badge variant={own ? 'success' : 'destructive'} title="Set for this site">
                {own ? labels[0] : labels[1]}
            </Badge>
        );
    }
    return <InheritedBadge title={`Inherited from ${inheritedFrom}`}>
        {inherited == null ? 'Default' : inherited ? labels[0] : labels[1]}
    </InheritedBadge>;
}

export function InheritedBadge({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
    return (
        <Badge variant="outline" title={title}
               className={cn('border-dashed font-normal text-muted-foreground', className)}>
            {children}
        </Badge>
    );
}

/** Legend explaining the two value styles. */
export function OriginLegend() {
    return (
        <span className="inline-flex items-center gap-2">
            <Badge variant="success">Set</Badge><span>for this site</span>
            <InheritedBadge title="Inherited">Inherited</InheritedBadge><span>from global settings</span>
        </span>
    );
}
