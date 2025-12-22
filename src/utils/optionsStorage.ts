import OptionsSync from "webext-options-sync";

export default new OptionsSync({
    defaults: {
        downloadRouterServerHost: "",
        sendCookies: true,
        sendUserAgent: true,
        sendReferrer: true,
        apiKey: "",
    },

    // List of functions that are called when the extension is updated
    migrations: [
        (savedOptions, currentDefaults) => {
            // Perhaps it was renamed
            // if (savedOptions.colour) {
            //     savedOptions.color = savedOptions.colour;
            //delete savedOptions.colour;
            // }
        },

        // Integrated utility that drops any properties that don't appear in the defaults
        OptionsSync.migrations.removeUnused
    ],
    logging: false
});