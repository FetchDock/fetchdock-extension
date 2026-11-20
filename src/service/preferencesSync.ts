import optionsStorage from '@/utils/optionsStorage';
import { apiService } from '@/service/apiService';
import { clientPreferencesSyncItem } from '@/lib/storageItems';
import { CLIENT_TYPE } from '@/api/schemas';
import type { Theme, WxtAppConfig } from '@/lib/types';

/** Options shared between the user's browser extensions via /users/client-preferences/browser-extension. */
const SYNCED_KEYS = [
    'theme',
    'commandPaletteShortcut',
    'notifyOnAccepted',
    'notifyOnRejected',
    'notifyOnJobFinished',
] as const;

type SyncedKey = typeof SYNCED_KEYS[number];
type SyncedPreferences = Partial<Pick<WxtAppConfig, SyncedKey>>;

const THEMES: Theme[] = ['light', 'dark', 'system'];

function pick(options: Partial<WxtAppConfig>): SyncedPreferences {
    return Object.fromEntries(SYNCED_KEYS.filter((key) => key in options).map((key) => [key, options[key]]));
}

/** Keeps only known keys with valid values from the (opaque) server data. */
function sanitize(data: Record<string, unknown>): SyncedPreferences {
    const result: SyncedPreferences = {};
    if (typeof data.theme === 'string' && THEMES.includes(data.theme as Theme)) {
        result.theme = data.theme as Theme;
    }
    if (typeof data.commandPaletteShortcut === 'string' && data.commandPaletteShortcut.length <= 64) {
        result.commandPaletteShortcut = data.commandPaletteShortcut;
    }
    for (const key of ['notifyOnAccepted', 'notifyOnRejected', 'notifyOnJobFinished'] as const) {
        if (typeof data[key] === 'boolean') {
            result[key] = data[key];
        }
    }
    return result;
}

function serialize(preferences: SyncedPreferences): string {
    return JSON.stringify(SYNCED_KEYS.map((key) => preferences[key] ?? null));
}

/** Applies the server copy when it changed since the last sync. Returns whether anything was applied. */
export async function pullPreferences(): Promise<boolean> {
    const remote = await apiService.getClientPreferences(CLIENT_TYPE);
    const state = await clientPreferencesSyncItem.getValue();
    if (!remote.updatedAt || remote.updatedAt === state.updatedAt) {
        return false;
    }

    const preferences = sanitize(remote.data ?? {});
    // Record the state first, so the resulting options change isn't pushed back
    await clientPreferencesSyncItem.setValue({ updatedAt: remote.updatedAt, data: serialize(preferences) });
    if (Object.keys(preferences).length > 0) {
        await optionsStorage.set(preferences);
    }
    return true;
}

/** Pushes the local preferences unless they equal what was last applied or pushed. */
export async function pushPreferences(): Promise<void> {
    const preferences = pick(await optionsStorage.getAll());
    const data = serialize(preferences);
    const state = await clientPreferencesSyncItem.getValue();
    if (state.data === data) {
        return;
    }

    const saved = await apiService.putClientPreferences(CLIENT_TYPE, preferences);
    await clientPreferencesSyncItem.setValue({ updatedAt: saved.updatedAt ?? null, data });
}

/** Pulls the server copy, then pushes local changes (also seeds the server on first use). */
export async function syncPreferences(): Promise<void> {
    try {
        await pullPreferences();
        await pushPreferences();
    } catch (err) {
        console.warn('[preferencesSync] Sync failed:', err);
    }
}

export function preferencesChanged(newOptions: Partial<WxtAppConfig>, oldOptions: Partial<WxtAppConfig>): boolean {
    return serialize(pick(newOptions)) !== serialize(pick(oldOptions));
}
