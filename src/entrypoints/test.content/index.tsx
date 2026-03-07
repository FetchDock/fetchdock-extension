import { sendMessage } from "@/lib/messaging";
import type { OAuth2AuthResult } from "@/lib/types";

export default defineContentScript({
    matches: ['<all_urls>'],

    async main() {
        // Only act on pages that contain the server's auth-result element.
        const resultEl = document.getElementById('auth-result');
        if (!resultEl) return;

        const success = resultEl.dataset.success === 'true';

        const result: OAuth2AuthResult = success
            ? {
                success: true,
                access_token: resultEl.dataset.accessToken ?? null,
                refresh_token: resultEl.dataset.refreshToken ?? null,
                expires_in: resultEl.dataset.expiresIn ? parseInt(resultEl.dataset.expiresIn, 10) : null,
                token_type: resultEl.dataset.tokenType ?? 'Bearer',
            }
            : {
                success: false,
                error: resultEl.dataset.error ?? 'unknown_error',
                error_description: resultEl.dataset.errorDescription ?? '',
            };

        // Store the tokens via the background worker (which will also close this tab).
        await sendMessage('storeOAuth2Tokens', result);

        // Notify the options page (or any other listener) that auth is complete
        await sendMessage('oauth2CallbackReceived', result);
    },
});