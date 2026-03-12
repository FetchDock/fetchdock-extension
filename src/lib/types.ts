export interface DownloadJob {

}

export interface AcceptedDownloadJob extends DownloadJob {
    jobId: string;
    accepted: boolean;
}

export type Theme = 'light' | 'dark' | 'system';

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
    /** Optional cookies to pass to the downloader */
    cookies?: Record<string, string> | string | null;
    /** IRI of the preferred downloader, e.g. "/downloaders/1" */
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
