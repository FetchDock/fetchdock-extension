import { storage } from '#imports';

/**
 * Site settings kept only on this device. They apply while "Use my settings from the server" is off,
 * on top of the local global toggles (and can still only restrict what the server allows).
 */
export interface LocalSiteSettings {
    /** Server site this entry belongs to; null for a site defined only in the extension */
    slug: string | null;
    name: string;
    /** Lowercase host names; for server sites a copy of the site's domains, used when the server can't be reached */
    domains: string[];
    sendCookies: boolean | null;
    sendUserAgent: boolean | null;
    sendReferrer: boolean | null;
    updatedAt: string;
}

export const localSiteSettingsItem = storage.defineItem<Record<string, LocalSiteSettings>>('local:localSiteSettings', {
    fallback: {},
});

/** Storage key of an entry: the server slug, or `local:<first domain>` for extension-only sites. */
export function localSiteKey(entry: Pick<LocalSiteSettings, 'slug' | 'domains'>): string {
    return entry.slug ?? `local:${entry.domains[0] ?? ''}`;
}

export function normalizeDomains(input: string[] | string): string[] {
    const list = Array.isArray(input) ? input : input.split(/[\s,]+/);
    const domains = list
        .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\*\./, ''))
        .filter((d) => /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(d));
    return [...new Set(domains)];
}

function hostMatches(host: string, domain: string): boolean {
    return host === domain || host.endsWith(`.${domain}`);
}

/** Finds the local entry for a URL: by server site slug first, then by domain. */
export function findLocalSiteSettings(
    entries: Record<string, LocalSiteSettings>,
    url: string,
    slug?: string | null,
): LocalSiteSettings | null {
    if (slug && entries[slug]) {
        return entries[slug];
    }

    let host: string;
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }

    // Prefer the most specific domain match
    let best: { entry: LocalSiteSettings; length: number } | null = null;
    for (const entry of Object.values(entries)) {
        for (const domain of entry.domains) {
            if (hostMatches(host, domain) && (!best || domain.length > best.length)) {
                best = { entry, length: domain.length };
            }
        }
    }
    return best?.entry ?? null;
}

export async function saveLocalSiteSettings(entry: Omit<LocalSiteSettings, 'updatedAt'>): Promise<LocalSiteSettings> {
    const saved: LocalSiteSettings = { ...entry, domains: normalizeDomains(entry.domains), updatedAt: new Date().toISOString() };
    const entries = await localSiteSettingsItem.getValue();
    entries[localSiteKey(saved)] = saved;
    await localSiteSettingsItem.setValue(entries);
    return saved;
}

export async function deleteLocalSiteSettings(key: string): Promise<void> {
    const entries = await localSiteSettingsItem.getValue();
    delete entries[key];
    await localSiteSettingsItem.setValue(entries);
}
