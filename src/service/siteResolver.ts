import { apiService } from '@/service/apiService';
import { getMergedAppConfig } from '@/lib/config';
import { siteResolveCacheItem } from '@/lib/storageItems';
import type { SiteResolution } from '@/api/schemas';

/** How long a resolution is reused for other URLs of the same host. */
const CACHE_TTL_MS = 60 * 60 * 1000;

async function currentServer(): Promise<string> {
    return ((await getMergedAppConfig()).downloadRouterServerHost ?? '').replace(/\/+$/, '');
}

function hostOf(url: string): string | null {
    try {
        const parsed = new URL(url);
        return /^https?:$/.test(parsed.protocol) ? parsed.hostname.toLowerCase() : null;
    } catch {
        return null;
    }
}

/**
 * Resolves a URL to its site, downloaders and effective settings (GET /sites/resolve), cached per host.
 * Returns null for non-http(s) URLs or when the server can't resolve it (unconfigured, offline, older server).
 */
export async function resolveSite(url: string, options: { force?: boolean } = {}): Promise<SiteResolution | null> {
    const host = hostOf(url);
    if (!host) {
        return null;
    }

    const server = await currentServer();
    if (!server) {
        return null;
    }

    const cache = await siteResolveCacheItem.getValue();
    const cached = cache[host];
    if (!options.force && cached && cached.server === server && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return { ...cached.resolution, url };
    }

    let resolution: SiteResolution;
    try {
        resolution = await apiService.resolveSite(url);
    } catch (err) {
        console.warn('[siteResolver] Resolving failed for', url, err);
        return null;
    }

    // Only cache positive results: an unsupported answer may be specific to this URL (e.g. a front page whose
    // extractors only match media pages), and must not hide other URLs of the host. Failures throw above.
    const fresh = await siteResolveCacheItem.getValue();
    if (resolution?.site) {
        fresh[host] = { server, fetchedAt: Date.now(), resolution };
    } else {
        delete fresh[host];
    }
    await siteResolveCacheItem.setValue(pruneExpired(fresh));

    return resolution;
}

/** Drops cached resolutions of a site (after its site settings changed). */
export async function invalidateSite(slug: string): Promise<void> {
    const cache = await siteResolveCacheItem.getValue();
    const kept = Object.fromEntries(
        Object.entries(cache).filter(([, entry]) => entry.resolution.site?.slug !== slug),
    );
    await siteResolveCacheItem.setValue(kept);
}

/** Drops all cached resolutions (after a settings layer that applies to every site changed). */
export async function clearSiteResolveCache(): Promise<void> {
    await siteResolveCacheItem.setValue({});
}

function pruneExpired<T extends { fetchedAt: number }>(cache: Record<string, T>): Record<string, T> {
    const now = Date.now();
    return Object.fromEntries(Object.entries(cache).filter(([, entry]) => now - entry.fetchedAt < CACHE_TTL_MS));
}
