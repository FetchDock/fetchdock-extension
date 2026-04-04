export type Theme = 'light' | 'dark' | 'system';

// ─── Cookie ───────────────────────────────────────────────────────────────────
// The `cookies` property on DownloadJob / DownloadJobDTO is not formally typed
// in docs.jsonld, but the server expects an array of these objects.

export interface CookieDTO {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    /** SameSite policy: 'no_restriction' | 'lax' | 'strict' | 'unspecified' */
    sameSite?: string;
    /** ISO-8601 datetime string, e.g. "2026-12-31T23:59:59.000Z" */
    expirationDate?: string;
}

// ─── Resource interfaces (shaped after docs.jsonld) ───────────────────────────
// Relations may arrive as IRI strings (JSON-LD) or as embedded objects
// depending on whether the server expands them. Both forms are valid here.

export interface DownloadJob {
    '@id'?: string;
    '@type'?: string;
    id?: number;
    /** Unique token for this job (read-only) */
    token?: string;
    uri?: string;
    userAgent?: string | null;
    cookies?: CookieDTO[] | null;
    state?: number | string | null;
    /** IRI of the selected downloader or embedded object */
    downloader?: string | null;
    downloadJobEvents?: string | DownloadJobEvent[];
    files?: string | DownloadedFile[];
    /** Owner identity (IRI or embedded OidcSubjectIdentifier) */
    owner?: string | OidcSubjectIdentifier | null;
    createdAt?: string;
    updatedAt?: string;
    /** Resolved public URL for this job (read-only) */
    url?: string | null;
}

export interface DownloadJobEvent {
    '@id'?: string;
    '@type'?: string;
    downloadJob?: string | DownloadJob;
    workerIdentifier?: string;
    event?: string;
    source?: string;
    updateMessage?: string;
    context?: any;
    metadata?: any;
    exceptionMessage?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface DownloadedFile {
    '@id'?: string;
    '@type'?: string;
    downloadJob?: string | DownloadJob;
    path?: string;
    metadata?: any;
    visible?: boolean;
    /** Derived filename (read-only) */
    filename?: string;
    /** Download URI (read-only) */
    downloadUri?: string;
}

export interface Downloader {
    '@id'?: string;
    '@type'?: string;
    id?: string;
    enabled?: boolean;
    downloaderType?: any;
    supportedDomains?: string[] | any;
}

/** OIDC subject identity — new resource in latest API */
export interface OidcSubjectIdentifier {
    '@id'?: string;
    '@type'?: string;
    subject?: string;
    downloadJobs?: string | DownloadJob[];
}

export interface SupportedSite {
    '@id'?: string;
    '@type'?: string;
    name?: string;
    description?: string;
    domains?: string[] | any;
    enabled?: boolean;
    metadata?: any;
}

export interface Version {
    '@id'?: string;
    '@type'?: string;
    id?: string;
    /** @deprecated Use currentVersion */
    version?: string;
    currentVersion?: string;
    latestVersion?: string;
}

export interface AcceptedDownloadJob extends DownloadJob {
    jobId: string;
    accepted: boolean;
}

export interface ApiTestResult {
    success: boolean;
    host: string;
    authMode?: string;
    version?: string;
    message: string;
}

/**
 * Payload sent to the content script when the server rejects a download job (4xx response).
 */
export interface RejectedDownloadJob {
    /** The URI that was submitted */
    uri: string;
    /** HTTP status code returned by the server */
    status: number;
    /** Human-readable rejection reason (from server response body) */
    message?: string;
}

/**
 * Payload sent to the content script when a download job reaches a terminal state
 * via a Mercure SSE event.
 */
export interface DownloadJobFinished {
    /** The unique token of the finished job */
    jobToken: string;
    /** Final state value from the server (e.g. 3 = completed, 4 = failed, 5 = cancelled) */
    state: number | string;
    /** The original URI that was downloaded */
    uri?: string;
}

/**
 * The input shape for POST /download_jobs.
 * Only writable fields from the DownloadJob resource are included.
 * @see docs.jsonld #DownloadJob supportedProperty (writeable: true)
 */
export interface DownloadJobDTO {
    /** The URI to download */
    uri: string;
    /** Optional User-Agent string to pass to the downloader */
    userAgent?: string | null;
    /** Cookies to forward to the downloader */
    cookies?: CookieDTO[];
    /** IRI of the preferred downloader, e.g. "/downloaders/yt-dlp" */
    downloader?: string | null;
}

export interface WxtAppConfig {
    downloadRouterServerHost?: string;
    sendCookies: boolean;
    sendUserAgent: boolean;
    sendReferrer: boolean;
    oauth2AccessToken?: string;
    oauth2RefreshToken?: string;
    oauth2TokenExpiresAt?: number;
    commandPaletteShortcut?: string;
    theme?: Theme;
    /** Show a toast when the server accepts a submitted link */
    notifyOnAccepted: boolean;
    /** Show a toast when the server rejects a submitted link (4xx) */
    notifyOnRejected: boolean;
    /** Show a toast when a download job finishes (via Mercure) */
    notifyOnJobFinished: boolean;
}

export interface OAuth2AuthResult {
    success: boolean;
    access_token?: string | null;
    refresh_token?: string | null;
    expires_in?: number | null;
    token_type?: string;
    error?: string;
    error_description?: string;
    /** Tab ID of the OAuth2 popup, so the background can close it after storing tokens */
    tabId?: number;
}

export type TokenState =
    | { status: 'none' }
    | { status: 'valid';   accessToken: string; expiresAt: number | null }
    | { status: 'expired'; accessToken: string; refreshToken: string | null; expiresAt: number }
    | { status: 'refreshing' };
