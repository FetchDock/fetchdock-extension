import OptionsSync from "webext-options-sync";

/** Key under which webext-options-sync stores the options object (its default `storageName`). */
export const OPTIONS_STORAGE_NAME = 'options';

export default new OptionsSync({
    // Device-local: options include OAuth tokens and per-device choices, which must not roam via storage.sync.
    // Settings shared between devices are synced through the server instead (see `useServerSettings`).
    storageType: 'local',
    storageName: OPTIONS_STORAGE_NAME,
    defaults: {
        downloadRouterServerHost: "",
        sendCookies: false as boolean,
        sendUserAgent: false as boolean,
        sendReferrer: false as boolean,
        /** Read/write the user's settings from the server instead of only using the local toggles above */
        useServerSettings: false as boolean,
        oauth2AccessToken: "",
        oauth2RefreshToken: "",
        oauth2TokenExpiresAt: 0,
        commandPaletteShortcut: "ctrl+k",
        theme: "system" as "light" | "dark" | "system",
        notifyOnAccepted: true as boolean,
        notifyOnRejected: true as boolean,
        notifyOnJobFinished: true as boolean,
    },

    // List of functions that are called when the extension is updated
    migrations: [
        (savedOptions, _currentDefaults) => {
            // Remove legacy apiKey field if present
            if ('apiKey' in savedOptions) {
                delete (savedOptions as any).apiKey;
            }
        },

        // Integrated utility that drops any properties that don't appear in the defaults
        OptionsSync.migrations.removeUnused
    ],
    logging: false
});

/**
 * One-time move of the options from storage.sync (used up to 0.7) to storage.local.
 *
 * The stored value is copied as-is (webext-options-sync reads both its compressed and plain formats), then removed
 * from storage.sync so OAuth tokens no longer roam. An existing local copy wins.
 */
export async function migrateOptionsToLocalStorage(): Promise<void> {
    const synced = await browser.storage.sync.get(OPTIONS_STORAGE_NAME);
    if (!(OPTIONS_STORAGE_NAME in synced)) {
        return;
    }

    const local = await browser.storage.local.get(OPTIONS_STORAGE_NAME);
    if (!(OPTIONS_STORAGE_NAME in local)) {
        await browser.storage.local.set({ [OPTIONS_STORAGE_NAME]: synced[OPTIONS_STORAGE_NAME] });
    }
    await browser.storage.sync.remove(OPTIONS_STORAGE_NAME);
    console.info('[optionsStorage] Migrated options from storage.sync to storage.local');
}
