import { onMessage } from '@/lib/messaging';
import { getMergedAppConfig } from '@/lib/config';
import { tokenManager } from '@/lib/tokenManager';
import {
    accountDeletedNoticeItem,
    clientPreferencesSyncItem,
    clientRegistrationItem,
    knownAccountItem,
    serverUserSettingsItem,
} from '@/lib/storageItems';
import { apiService } from '@/service/apiService';
import { call } from '@/service/apiErrors';
import { ensureClientRegistered } from '@/service/clientRegistry';
import { mercureService } from '@/service/mercureService';
import { clearSiteResolveCache } from '@/service/siteResolver';

/**
 * The server account behind the stored token. When the account is deleted (here, in the PWA or on another device),
 * the server publishes `account_deleted` on the user's Mercure topic; the extension then signs out and clears its
 * server-bound state, instead of re-creating an empty account with its next request. Because the service worker
 * isn't always running to receive that event, `verifyAccount()` also compares the account's uuid with the last one
 * seen whenever a signed-in session starts.
 */

async function currentServer(): Promise<string> {
    return ((await getMergedAppConfig()).downloadRouterServerHost ?? '').replace(/\/+$/, '');
}

let signingOut: Promise<void> | null = null;

/** Signs out and clears the state bound to the deleted account: tokens, client registration, synced settings. */
export function signOutDeletedAccount(fromThisDevice: boolean): Promise<void> {
    signingOut ??= doSignOut(fromThisDevice).finally(() => { signingOut = null; });
    return signingOut;
}

async function doSignOut(fromThisDevice: boolean): Promise<void> {
    const server = await currentServer();
    // Tokens first, so nothing sends another request that would create a new account
    await tokenManager.revokeTokens();
    await mercureService.reset();
    await Promise.all([
        clientRegistrationItem.removeValue(),
        serverUserSettingsItem.removeValue(),
        clientPreferencesSyncItem.removeValue(),
        knownAccountItem.removeValue(),
        clearSiteResolveCache(),
    ]);
    await accountDeletedNoticeItem.setValue({ server, at: new Date().toISOString(), fromThisDevice });
    console.info('[account] Signed out: the account was deleted');
}

/**
 * Compares the current account with the last one seen for the same server and subject. A different uuid (or none)
 * means the account was deleted meanwhile: signs out and returns false. Otherwise remembers the account.
 * Network and server errors are ignored (returns true).
 */
export async function verifyAccount(): Promise<boolean> {
    const server = await currentServer();
    if (!server) {
        return true;
    }
    let user;
    try {
        user = await apiService.getCurrentUser();
    } catch (err) {
        console.warn('[account] Could not check the account:', err);
        return true;
    }

    const known = await knownAccountItem.getValue();
    if (known && known.server === server && known.subject === user.subject && known.uuid !== user.uuid) {
        await signOutDeletedAccount(false);
        return false;
    }
    if (user.subject && user.uuid) {
        await knownAccountItem.setValue({ server, subject: user.subject, uuid: user.uuid });
    }
    return true;
}

/**
 * Starts a signed-in session (worker startup, sign-in, host change): checks the account, registers the client and
 * keeps the Mercure stream open for account events. Returns false when the account turned out to be deleted.
 */
export async function startSignedInSession(options: { freshSignIn?: boolean } = {}): Promise<boolean> {
    if (options.freshSignIn) {
        // A new sign-in may get a new account legitimately (e.g. after deleting it in the PWA)
        await knownAccountItem.removeValue();
        await accountDeletedNoticeItem.removeValue();
    }
    if (!(await verifyAccount())) {
        return false;
    }
    await ensureClientRegistered();
    if ((await knownAccountItem.getValue())?.server !== await currentServer()) {
        // The account didn't exist before the registration created it
        await verifyAccount();
    }
    mercureService.setSignedIn(true);
    return true;
}

export function registerAccountHandlers(): void {
    mercureService.onAccountDeleted(() => {
        void signOutDeletedAccount(false);
    });

    onMessage('getCurrentUser', () => call(() => apiService.getCurrentUser()));

    onMessage('deleteAccount', ({ data }) => call(async () => {
        await apiService.deleteCurrentUser(data.confirm);
        await signOutDeletedAccount(true);
        return true;
    }));
}
