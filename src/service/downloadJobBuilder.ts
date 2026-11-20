import { getMergedAppConfig } from '@/lib/config';
import { resolveSite } from '@/service/siteResolver';
import type { CookieDTO, DownloadJobDTO } from '@/lib/types';
import type { RequestContext } from '@/api/schemas';

async function collectCookies(url: string): Promise<CookieDTO[]> {
    const cookies = await browser.cookies.getAll({ url });
    return cookies.map((cookie) => {
        const payload: CookieDTO = {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite,
        };
        if (cookie.expirationDate !== undefined) {
            // Floating-point epoch seconds → ISO-8601
            payload.expirationDate = new Date(cookie.expirationDate * 1000).toISOString();
        }
        return payload;
    });
}

function isHttpUrl(url: string | undefined): url is string {
    return !!url && /^https?:\/\//i.test(url);
}

/**
 * Decides which request context to attach:
 * - the server's resolved `requestContext` (all settings layers incl. this client's) is the base;
 * - local toggles are applied last: with server settings on they mirror the server, so the server decides;
 *   with server settings off they are the device's choice and can only restrict what the server allows;
 * - without a resolution (offline, older server) the local toggles decide.
 */
export function mergeRequestContext(
    resolved: RequestContext | undefined,
    local: { sendCookies: boolean; sendUserAgent: boolean; sendReferrer: boolean; useServerSettings: boolean },
): Required<RequestContext> {
    const localContext = { cookies: local.sendCookies, userAgent: local.sendUserAgent, referrer: local.sendReferrer };
    if (!resolved) {
        return localContext;
    }

    const serverContext = {
        cookies: resolved.cookies ?? false,
        userAgent: resolved.userAgent ?? false,
        referrer: resolved.referrer ?? false,
    };
    if (local.useServerSettings) {
        return serverContext;
    }

    return {
        cookies: serverContext.cookies && localContext.cookies,
        userAgent: serverContext.userAgent && localContext.userAgent,
        referrer: serverContext.referrer && localContext.referrer,
    };
}

/**
 * Builds the download job for `uri`: resolves the site, then attaches cookies, user agent and referrer
 * (the page the URL was found on) as the effective request context allows.
 */
export async function buildDownloadJob(uri: string, pageUrl?: string): Promise<DownloadJobDTO> {
    const [config, resolution] = await Promise.all([getMergedAppConfig(), resolveSite(uri)]);
    const context = mergeRequestContext(resolution?.requestContext, config);

    const job: DownloadJobDTO = { uri };
    if (context.cookies) {
        job.cookies = await collectCookies(uri);
    }
    if (context.userAgent) {
        job.userAgent = navigator.userAgent;
    }
    if (context.referrer && isHttpUrl(pageUrl) && pageUrl !== uri) {
        job.referrer = pageUrl;
    }

    return job;
}
