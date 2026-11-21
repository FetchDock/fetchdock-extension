/**
 * The server's `/.well-known/browser-extension` document.
 *
 * Servers >= 0.6 describe authentication in an `authentication` object (`mode`, `oauth2`); the top-level
 * `auth_mode` / `oauth2` fields of older servers are deprecated but still read as a fallback.
 */
export interface OAuth2Endpoints {
    authorization_endpoint?: string;
    token_endpoint?: string;
    [key: string]: unknown;
}

export interface WellKnownInfo {
    version: string;
    authMode: string;
    oauth2: OAuth2Endpoints | null;
}

/** Parses the document; returns null when it lacks a version or an auth mode. */
export function parseWellKnown(data: any): WellKnownInfo | null {
    const authentication = data?.authentication;
    const authMode: unknown = authentication?.mode ?? data?.auth_mode;
    const oauth2: unknown = authentication?.oauth2 ?? data?.oauth2;

    if (!data?.version || typeof authMode !== 'string' || !authMode) {
        return null;
    }

    return {
        version: String(data.version),
        authMode,
        oauth2: oauth2 && typeof oauth2 === 'object' ? oauth2 as OAuth2Endpoints : null,
    };
}

/** The OAuth2 token endpoint from the document, if any. */
export function wellKnownTokenEndpoint(data: any): string | undefined {
    const endpoint = (data?.authentication?.oauth2 ?? data?.oauth2)?.token_endpoint;
    return typeof endpoint === 'string' && endpoint ? endpoint : undefined;
}
