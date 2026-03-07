import optionsStorage from '@/utils/optionsStorage';
import type { OAuth2AuthResult, TokenState, WxtAppConfig } from '@/lib/types';

/**
 * How many milliseconds before the real expiry we consider the token "expired"
 * and proactively refresh it. Defaults to 60 s.
 */
const EXPIRY_BUFFER_MS = 60_000;

/**
 * TokenManager
 *
 * Central place for all token lifecycle logic:
 *   - Reading tokens from storage
 *   - Deciding whether the access token is still valid
 *   - Refreshing an expired token via the server's token_endpoint
 *   - Storing new tokens back to storage
 *   - Revoking (clearing) tokens
 *
 * Consumers should call `tokenManager.getAccessToken()` to always get a
 * fresh, valid token — the manager handles expiry and refresh transparently.
 *
 * The singleton instance is exported as `tokenManager`.
 */
class TokenManager {
    /** In-flight refresh promise — deduplicated so concurrent callers share one request. */
    private refreshPromise: Promise<string | null> | null = null;

    // ------------------------------------------------------------------
    // Public read API
    // ------------------------------------------------------------------

    /**
     * Returns the current token state derived from storage, without any
     * side effects. Useful for UI display ("authenticated", "expired", …).
     */
    async getTokenState(): Promise<TokenState> {
        const opts = await optionsStorage.getAll();
        return this.deriveState(opts);
    }

    /**
     * Returns `true` when the stored access token exists but its expiry
     * timestamp is in the past (accounting for the buffer window).
     */
    async isTokenExpired(): Promise<boolean> {
        const state = await this.getTokenState();
        return state.status === 'expired';
    }

    /**
     * Returns `true` when a non-expired access token is present.
     */
    async isAuthenticated(): Promise<boolean> {
        const state = await this.getTokenState();
        return state.status === 'valid';
    }

    /**
     * Returns a valid access token, refreshing it first if it has expired.
     * Returns `null` when no token is stored at all or after a failed refresh.
     *
     * @param tokenEndpoint  Full URL of the server's OAuth2 token endpoint.
     *                       Required only when a refresh may be needed; if the
     *                       current token is still valid the parameter is ignored.
     */
    async getAccessToken(tokenEndpoint?: string): Promise<string | null> {
        const state = await this.getTokenState();

        if (state.status === 'none') {
            return null;
        }

        if (state.status === 'valid') {
            return state.accessToken;
        }

        // Token is expired — attempt a refresh
        if (state.status === 'expired') {
            if (!tokenEndpoint) {
                console.warn('[TokenManager] Access token is expired but no tokenEndpoint was provided — cannot refresh.');
                return state.accessToken; // return stale token; caller can decide what to do
            }

            if (!state.refreshToken) {
                console.warn('[TokenManager] Access token is expired but no refresh token is stored.');
                return null;
            }

            return this.refresh(tokenEndpoint, state.refreshToken);
        }

        // status === 'refreshing' — wait for the in-flight promise
        return this.refreshPromise;
    }

    // ------------------------------------------------------------------
    // Public write API
    // ------------------------------------------------------------------

    /**
     * Persists tokens received from an OAuth2 auth flow (or a token refresh
     * response) into extension storage.
     */
    async storeTokens(result: OAuth2AuthResult): Promise<void> {
        if (!result.success || !result.access_token) {
            throw new Error(
                `[TokenManager] Cannot store tokens: auth result indicates failure. ` +
                `error=${result.error ?? 'unknown'}, description=${result.error_description ?? ''}`
            );
        }

        const expiresAt = result.expires_in
            ? Date.now() + result.expires_in * 1000
            : 0;

        await optionsStorage.set({
            oauth2AccessToken:   result.access_token  ?? '',
            oauth2RefreshToken:  result.refresh_token ?? '',
            oauth2TokenExpiresAt: expiresAt,
        });

        console.log('[TokenManager] Tokens stored. Expires at:', expiresAt ? new Date(expiresAt).toISOString() : 'never');
    }

    /**
     * Clears all stored tokens, effectively logging the user out.
     */
    async revokeTokens(): Promise<void> {
        await optionsStorage.set({
            oauth2AccessToken:    '',
            oauth2RefreshToken:   '',
            oauth2TokenExpiresAt: 0,
        });
        console.log('[TokenManager] Tokens revoked.');
    }

    // ------------------------------------------------------------------
    // Token refresh
    // ------------------------------------------------------------------

    /**
     * Exchanges a refresh token for a new access token at `tokenEndpoint`.
     * Concurrent calls are collapsed into a single HTTP request.
     *
     * Returns the new access token, or `null` on failure.
     */
    async refresh(tokenEndpoint: string, refreshToken?: string): Promise<string | null> {
        // Deduplicate concurrent refresh calls
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this._doRefresh(tokenEndpoint, refreshToken)
            .finally(() => { this.refreshPromise = null; });

        return this.refreshPromise;
    }

    private async _doRefresh(tokenEndpoint: string, refreshToken?: string): Promise<string | null> {
        const opts = await optionsStorage.getAll();
        const storedRefreshToken = refreshToken ?? opts.oauth2RefreshToken ?? '';

        if (!storedRefreshToken) {
            console.warn('[TokenManager] No refresh token available — cannot refresh.');
            return null;
        }

        console.log('[TokenManager] Refreshing access token...');

        try {
            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type:    'refresh_token',
                    refresh_token: storedRefreshToken,
                }).toString(),
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                console.error(`[TokenManager] Token refresh failed (${response.status}):`, body);
                return null;
            }

            const data = await response.json() as {
                access_token:  string;
                refresh_token?: string;
                expires_in?:   number;
                token_type?:   string;
            };

            await this.storeTokens({
                success:       true,
                access_token:  data.access_token,
                refresh_token: data.refresh_token ?? storedRefreshToken, // keep old refresh token if not rotated
                expires_in:    data.expires_in ?? null,
                token_type:    data.token_type ?? 'Bearer',
            });

            console.log('[TokenManager] Access token refreshed successfully.');
            return data.access_token;
        } catch (err) {
            console.error('[TokenManager] Unexpected error during token refresh:', err);
            return null;
        }
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    private deriveState(opts: Partial<WxtAppConfig>): TokenState {
        const accessToken  = opts.oauth2AccessToken  ?? '';
        const refreshToken = opts.oauth2RefreshToken ?? '';
        const expiresAt    = opts.oauth2TokenExpiresAt ?? 0;

        if (!accessToken) {
            return { status: 'none' };
        }

        // expiresAt === 0 means "no expiry info" — treat as valid
        if (expiresAt === 0 || Date.now() < expiresAt - EXPIRY_BUFFER_MS) {
            return { status: 'valid', accessToken, expiresAt: expiresAt || null };
        }

        return {
            status:       'expired',
            accessToken,
            refreshToken: refreshToken || null,
            expiresAt,
        };
    }
}

export const tokenManager = new TokenManager();

