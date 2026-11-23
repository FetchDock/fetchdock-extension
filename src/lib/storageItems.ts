import { storage } from '#imports';
import type { SiteResolution, UserSettings } from '@/api/schemas';

/** This device's registration in the server's client registry (POST /users/clients). */
export interface ClientRegistration {
    id: string;
    /** Server host the client was registered on; a host change requires a new registration */
    server: string;
}

export const clientRegistrationItem = storage.defineItem<ClientRegistration | null>('local:clientRegistration', {
    fallback: null,
});

export interface CachedSiteResolution {
    server: string;
    fetchedAt: number;
    resolution: SiteResolution;
}

/** GET /sites/resolve results by URL host. */
export const siteResolveCacheItem = storage.defineItem<Record<string, CachedSiteResolution>>('local:siteResolveCache', {
    fallback: {},
});

/** Last known copy of the user's global settings layer (GET /users/settings), for display while offline. */
export const serverUserSettingsItem = storage.defineItem<UserSettings | null>('local:serverUserSettings', {
    fallback: null,
});

export interface ClientPreferencesSyncState {
    /** `updatedAt` of the server copy last applied or pushed */
    updatedAt: string | null;
    /** Serialized data last applied or pushed, to skip no-op pushes */
    data: string | null;
}

export const clientPreferencesSyncItem = storage.defineItem<ClientPreferencesSyncState>('local:clientPreferencesSync', {
    fallback: { updatedAt: null, data: null },
});

/** The server account this device last saw (GET /users/me), to notice when it was deleted while the worker slept. */
export interface KnownAccount {
    server: string;
    subject: string;
    uuid: string;
}

export const knownAccountItem = storage.defineItem<KnownAccount | null>('local:knownAccount', {
    fallback: null,
});

/** Set when the extension signed out because the account was deleted; shown in the options page until the next sign-in. */
export interface AccountDeletedNotice {
    server: string;
    /** ISO 8601 time the extension signed out */
    at: string;
    /** Deleted from this device (options page) rather than elsewhere */
    fromThisDevice: boolean;
}

export const accountDeletedNoticeItem = storage.defineItem<AccountDeletedNotice | null>('local:accountDeletedNotice', {
    fallback: null,
});
