/**
 * HTTP → HTTPS upgrade helpers
 *
 * Problem: some servers sit behind a reverse proxy that terminates SSL.
 * The server itself reports `http://` URLs in its well-known document and
 * OAuth2 redirects, but the proxy redirects every HTTP request to HTTPS
 * with a 302. This causes CORS failures because:
 *
 *  1. The CORS preflight is sent to `http://` — the 302 changes the origin,
 *     the browser refuses to follow for preflight requests.
 *  2. POST bodies are NOT re-sent after a 302 redirect.
 *
 * Fix: always rewrite `http://` → `https://` for any URL that belongs to a
 * host that was originally configured with `https://`, and for any URL
 * discovered from a well-known document that was fetched over `https://`.
 *
 * Additionally: for GET discovery requests we use `redirect: 'follow'` and
 * record the final URL so we can upgrade all discovered endpoints to match.
 */

/** Rewrite http:// → https:// unconditionally. Safe to call on already-https URLs. */
export function upgradeToHttps(url: string): string {
    return url.replace(/^http:\/\//i, 'https://');
}

/**
 * If `base` (the configured server host) uses https://, upgrade `url` to
 * https:// as well. This handles the case where the well-known doc reports
 * http:// endpoints but the proxy enforces https://.
 */
export function upgradeUrlIfBaseIsHttps(url: string, base: string): string {
    if (base.startsWith('https://') || base.startsWith('HTTPS://')) {
        return upgradeToHttps(url);
    }
    return url;
}

/**
 * Resolves a potentially-relative endpoint URL against a base, then
 * upgrades it to https:// if the base uses https://.
 */
export function resolveEndpoint(endpoint: string, base: string): string {
    const resolved = endpoint.startsWith('http')
        ? endpoint
        : base.replace(/\/+$/, '') + (endpoint.startsWith('/') ? '' : '/') + endpoint;
    return upgradeUrlIfBaseIsHttps(resolved, base);
}

/**
 * Fetch wrapper for well-known/discovery GET requests.
 * Follows redirects and upgrades the URL to https:// before fetching if the
 * base host uses https://, preventing a round-trip redirect.
 */
export async function fetchDiscovery(url: string): Promise<Response> {
    const upgraded = upgradeToHttps(url);
    return fetch(upgraded, { redirect: 'follow' });
}

/**
 * Fetch wrapper for token endpoint POST requests.
 * Upgrades http:// → https:// before the request so we never hit the proxy
 * redirect at all, avoiding CORS issues entirely.
 */
export async function fetchToken(url: string, init: RequestInit): Promise<Response> {
    const upgraded = upgradeToHttps(url);
    return fetch(upgraded, { ...init, redirect: 'follow' });
}

