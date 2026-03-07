export interface DownloadJob {

}

export interface AcceptedDownloadJob extends DownloadJob {
    jobId: string;
    accepted: boolean;
}

export interface WxtAppConfig {
    downloadRouterServerHost?: string;
    sendCookies: boolean;
    sendUserAgent: boolean;
    sendReferrer: boolean;
    oauth2AccessToken?: string;
    oauth2RefreshToken?: string;
    oauth2TokenExpiresAt?: number; // Unix timestamp (ms)
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
