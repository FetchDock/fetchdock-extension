import OptionsSync from "webext-options-sync";

export default new OptionsSync({
    defaults: {
        downloadRouterServerHost: "",
        sendCookies: false,
        sendUserAgent: false,
        sendReferrer: false,
        oauth2AccessToken: "",
        oauth2RefreshToken: "",
        oauth2TokenExpiresAt: 0,
        commandPaletteShortcut: "ctrl+k",
        theme: "system" as "light" | "dark" | "system",
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