import type { IntegrityStatus } from '@/api/schemas';

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

/** Code integrity summary announced in `/.well-known/browser-extension` (servers >= 0.9). */
export interface WellKnownIntegrity {
    status: IntegrityStatus;
    appVersion: string | null;
}

export interface WellKnownInfo {
    version: string;
    authMode: string;
    oauth2: OAuth2Endpoints | null;
    privacyPolicyUrl: string | null;
    integrity: WellKnownIntegrity | null;
}

const VALID_INTEGRITY_STATUSES: ReadonlySet<string> = new Set(['verified', 'modified', 'unknown']);

/** Resolves `privacyPolicyUrl` from the well-known document; accepts http(s) URLs or server-relative paths. */
export function resolvePrivacyPolicyUrl(policy: unknown, base?: string): string | null {
    if (typeof policy !== 'string') {
        return null;
    }
    const trimmed = policy.trim();
    if (!trimmed) {
        return null;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        if (base) {
            try {
                const parsed = new URL(trimmed);
                const baseUrl = new URL(base);
                if (parsed.host === baseUrl.host && baseUrl.protocol === 'https:' && parsed.protocol === 'http:') {
                    parsed.protocol = 'https:';
                    return parsed.toString();
                }
            } catch {
                return null;
            }
        }
        return trimmed;
    }
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && base) {
        try {
            const resolved = new URL(trimmed, base);
            if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
                return resolved.toString();
            }
        } catch {
            return null;
        }
    }
    return null;
}

/** Parses `integrity` from the well-known document; returns null on older servers that omit it. */
export function parseWellKnownIntegrity(data: any): WellKnownIntegrity | null {
    const raw = data?.integrity;
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const status: unknown = raw.status;
    if (typeof status !== 'string' || !VALID_INTEGRITY_STATUSES.has(status)) {
        return null;
    }
    const appVersion = typeof raw.appVersion === 'string' && raw.appVersion.trim()
        ? raw.appVersion.trim()
        : (typeof data?.version === 'string' && data.version.trim() ? data.version.trim() : null);

    return {
        status: status as IntegrityStatus,
        appVersion,
    };
}

/** Parses the document; returns null when it lacks a version or an auth mode. */
export function parseWellKnown(data: any, base?: string): WellKnownInfo | null {
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
        privacyPolicyUrl: resolvePrivacyPolicyUrl(data?.privacyPolicyUrl, base),
        integrity: parseWellKnownIntegrity(data),
    };
}

/** The OAuth2 token endpoint from the document, if any. */
export function wellKnownTokenEndpoint(data: any): string | undefined {
    const endpoint = (data?.authentication?.oauth2 ?? data?.oauth2)?.token_endpoint;
    return typeof endpoint === 'string' && endpoint ? endpoint : undefined;
}

/** Optional server features announced in the well-known document; a missing key means "not supported" (ADR 0007). */
export interface ServerFeatures {
    /** Whether the well-known document was fetched from the configured server */
    reachable: boolean;
    /** `features.failureReports.enabled` (servers >= 0.8) */
    failureReports: boolean;
    /** The instance operator's privacy policy (`privacyPolicyUrl`), null when the server publishes none */
    privacyPolicyUrl: string | null;
    /** Code integrity signal (`integrity`, servers >= 0.9), null on older servers */
    integrity: WellKnownIntegrity | null;
}

export const NO_SERVER_FEATURES: ServerFeatures = {
    reachable: false,
    failureReports: false,
    privacyPolicyUrl: null,
    integrity: null,
};

export function parseServerFeatures(data: any, base?: string): ServerFeatures {
    return {
        reachable: true,
        failureReports: data?.features?.failureReports?.enabled === true,
        privacyPolicyUrl: resolvePrivacyPolicyUrl(data?.privacyPolicyUrl, base),
        integrity: parseWellKnownIntegrity(data),
    };
}
