import React, {useEffect, useRef, useState} from "react";
import { i18n } from "#imports";
import optionsStorage from "@/utils/optionsStorage";
import {sendMessage} from "@/lib/messaging";
import { KeyComboInput } from "@/components/ui/key-combo-input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/lib/useTheme";

function App() {
    const formRef = useRef<HTMLFormElement | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [shortcut, setShortcut] = useState<string>('ctrl+k');
    const [theme, setTheme] = useTheme();
    const popupRef = useRef<Window | null>(null);

    useEffect(() => {
        const form = formRef.current;
        if (!form) return;

        // Wire the form to optionsStorage so it loads defaults and auto-saves
        optionsStorage.syncForm(form).catch((err) => {
            console.error('optionsStorage.syncForm failed', err);
            setStatus(i18n.t('messages.options.initializationFailed'));
        });

        // Reflect initial auth state
        optionsStorage.getAll().then((opts) => {
            setIsAuthenticated(!!opts.oauth2AccessToken);
            if (opts.commandPaletteShortcut) setShortcut(opts.commandPaletteShortcut);
        });

        // React to token changes written by the background worker.
        optionsStorage.onChanged((newOpts) => {
            const authenticated = !!newOpts.oauth2AccessToken;
            setIsAuthenticated(authenticated);
            if (newOpts.commandPaletteShortcut) setShortcut(newOpts.commandPaletteShortcut);
            if (authenticated) {
                popupRef.current = null;
                setStatus(i18n.t('messages.options.oauth2Success'));
                setTimeout(() => setStatus(null), 2000);
            }
        });

        const onSaveSuccess = () => {
            setStatus(i18n.t('messages.options.savedSuccessfully'));
            setTimeout(() => setStatus(null), 1200);
        };
        const onSaveError = (e: Event) => {
            console.error('Save error', e);
            setStatus(i18n.t('messages.options.errorSavingSettings'));
        };

        form.addEventListener('options-sync:save-success', onSaveSuccess as EventListener);
        form.addEventListener('options-sync:save-error', onSaveError as EventListener);

        return () => {
            form.removeEventListener('options-sync:save-success', onSaveSuccess as EventListener);
            form.removeEventListener('options-sync:save-error', onSaveError as EventListener);
        };
    }, []);

    const handleAuthenticate = async () => {
        const hostInput = formRef.current?.elements.namedItem('downloadRouterServerHost') as HTMLInputElement;
        const host = hostInput?.value?.trim();

        if (!host) {
            setStatus(i18n.t('messages.options.serverConnectionFailed'));
            return;
        }

        setStatus(i18n.t('messages.options.oauth2Authenticating'));

        let authUrl: string;
        try {
            authUrl = await sendMessage("getOAuth2AuthorizationUrl", host);
        } catch (err) {
            setStatus(i18n.t('messages.options.oauth2NotSupported'));
            return;
        }

        // Open the OAuth2 flow in a popup window. The extension's content script
        // (test.content) will detect the #auth-result element on the server's
        // callback page, extract the tokens and send them to the background via
        // storeOAuth2Tokens. optionsStorage.onChanged above will then fire and
        // update the UI — no postMessage or polling needed.
        const popup = window.open(
            authUrl,
            'oauth2-auth',
            'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        if (!popup) {
            setStatus(i18n.t('messages.options.oauth2Failed', { error: 'Could not open popup window' }));
            return;
        }

        popupRef.current = popup;
    };

    const handleRevoke = async () => {
        await sendMessage("revokeOAuth2Tokens", undefined);
        setIsAuthenticated(false);
        setStatus(i18n.t('messages.options.oauth2Revoked'));
        setTimeout(() => setStatus(null), 1500);
    };

    const handleRefresh = async () => {
        const refreshResult = await sendMessage("refreshOAuth2Tokens", undefined);
        if (refreshResult) {
            setIsAuthenticated(true);
            setStatus(i18n.t('messages.options.oauth2Refreshed'));
            setTimeout(() => setStatus(null), 1500);
        } else {
            setStatus(i18n.t('messages.options.oauth2RefreshFailed'));
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-8 ring shadow-xl ring-gray-900/5">
            {/* Page header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {i18n.t('forms.options.title')}
                </h1>
                <ThemeToggle value={theme} onChange={setTheme} variant="full" />
            </div>
            <form ref={formRef}>
                <div className="mb-4">
                    <label htmlFor="downloadRouterServerHost" className="block text-gray-900 dark:text-white mt-5 text-base font-medium tracking-tight">
                        {i18n.t('forms.options.labels.downloadRouterServerHost')}
                    </label>
                    <input
                        type="text"
                        id="downloadRouterServerHost"
                        name="downloadRouterServerHost"
                        className="mt-1 ml-0 border border-gray-300 rounded px-2 py-1 w-full text-black dark:text-white"
                    />
                    {/* Button to test the new host */}
                    <button type="button" className="mt-2 inline-flex items-center px-3 py-1 border rounded-4xl bg-sky-500 hover:bg-sky-700 text-white" onClick={async () => {
                        const hostInput = formRef.current?.elements.namedItem('downloadRouterServerHost') as HTMLInputElement;
                        const host = hostInput.value;

                        setStatus(i18n.t('messages.options.testingServerConnection'));
                        try {
                            const response = await sendMessage("testApiServiceHost", host);
                            setStatus(response);
                        } catch (err) {
                            setStatus(i18n.t('messages.options.serverConnectionFailed', { error: String(err) }));
                        }

                    }}>
                        {i18n.t('forms.buttons.testConnection')}
                    </button>
                    <span className="text-sm text-gray-600 mt-1">
                        {i18n.t('forms.options.help.downloadRouterServerHost')}
                    </span>
                </div>

                <div className="mb-2">
                    <label className="block text-gray-900 dark:text-white mt-5 text-base font-medium tracking-tight">
                        <input type="checkbox" id="sendCookies" name="sendCookies" className="mr-2" />
                        {i18n.t('forms.options.labels.sendCookies')}
                    </label>
                    <span className="text-sm text-gray-600 mt-1">
                        {i18n.t('forms.options.help.sendCookies')}
                    </span>
                </div>

                <div className="mb-2">
                    <label className="block text-gray-900 dark:text-white mt-5 text-base font-medium tracking-tight">
                        <input type="checkbox" id="sendUserAgent" name="sendUserAgent" className="mr-2" />
                        {i18n.t('forms.options.labels.sendUserAgent')}
                    </label>
                    <span className="text-sm text-gray-600 mt-1">
                        {i18n.t('forms.options.help.sendUserAgent')}
                    </span>
                </div>

                <div className="mb-4">
                    <label className="block text-gray-900 dark:text-white mt-5 text-base font-medium tracking-tight">
                        <input type="checkbox" id="sendReferrer" name="sendReferrer" className="mr-2" />
                        {i18n.t('forms.options.labels.sendReferrer')}
                    </label>
                    <span className="text-sm text-gray-600 mt-1">
                        {i18n.t('forms.options.help.sendReferrer')}
                    </span>
                </div>

                {/* ── Notifications ──────────────────────────────────────── */}
                <div className="mb-1 mt-6">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        {i18n.t('forms.options.labels.notifications')}
                    </h2>
                    <span className="text-sm text-gray-600">
                        {i18n.t('forms.options.help.notifications')}
                    </span>
                </div>

                <div className="mb-2">
                    <label className="block text-gray-900 dark:text-white mt-3 text-base font-medium tracking-tight">
                        <input type="checkbox" id="notifyOnAccepted" name="notifyOnAccepted" className="mr-2" />
                        {i18n.t('forms.options.labels.notifyOnAccepted')}
                    </label>
                    <span className="text-sm text-gray-600 mt-1">
                        {i18n.t('forms.options.help.notifyOnAccepted')}
                    </span>
                </div>

                <div className="mb-2">
                    <label className="block text-gray-900 dark:text-white mt-3 text-base font-medium tracking-tight">
                        <input type="checkbox" id="notifyOnRejected" name="notifyOnRejected" className="mr-2" />
                        {i18n.t('forms.options.labels.notifyOnRejected')}
                    </label>
                    <span className="text-sm text-gray-600 mt-1">
                        {i18n.t('forms.options.help.notifyOnRejected')}
                    </span>
                </div>

                <div className="mb-4">
                    <label className="block text-gray-900 dark:text-white mt-3 text-base font-medium tracking-tight">
                        <input type="checkbox" id="notifyOnJobFinished" name="notifyOnJobFinished" className="mr-2" />
                        {i18n.t('forms.options.labels.notifyOnJobFinished')}
                    </label>
                    <span className="text-sm text-gray-600 mt-1">
                        {i18n.t('forms.options.help.notifyOnJobFinished')}
                    </span>
                </div>

                {/* Command Palette Shortcut */}
                <div className="mb-4">
                    <label className="block text-gray-900 dark:text-white mt-5 text-base font-medium tracking-tight">
                        {i18n.t('forms.options.labels.commandPaletteShortcut')}
                    </label>
                    <div className="mt-2">
                        <KeyComboInput
                            value={shortcut}
                            onChange={combo => {
                                setShortcut(combo);
                                // Write directly so optionsStorage persists it without a form submit
                                optionsStorage.set({ commandPaletteShortcut: combo });
                            }}
                        />
                    </div>
                    <span className="text-sm text-gray-600 mt-1 block">
                        {i18n.t('forms.options.help.commandPaletteShortcut')}
                    </span>
                    {/* Hidden input so webext-options-sync can also sync this field */}
                    <input type="hidden" name="commandPaletteShortcut" value={shortcut} readOnly />
                </div>

                {/* OAuth2 Authentication */}
                <div className="mb-4">
                    <label className="block text-gray-900 dark:text-white mt-5 text-base font-medium tracking-tight">
                        {i18n.t('forms.options.labels.authentication')}
                    </label>
                    <div className="flex items-center gap-2 mt-2">
                        {isAuthenticated ? (
                            <>
                                <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {i18n.t('messages.options.oauth2TokenStored')}
                                </span>
                                <button
                                    type="button"
                                    className="inline-flex items-center px-3 py-1 border rounded-4xl bg-red-500 hover:bg-red-700 text-white text-sm"
                                    onClick={handleRevoke}
                                >
                                    {i18n.t('forms.buttons.revokeAuth')}
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="inline-flex items-center px-3 py-1 border rounded-4xl bg-sky-500 hover:bg-sky-700 text-white"
                                onClick={handleAuthenticate}
                            >
                                {i18n.t('forms.buttons.authenticate')}
                            </button>
                        )}
                    </div>
                    <span className="text-sm text-gray-600 mt-1">
                        {i18n.t('forms.options.help.authentication')}
                    </span>
                </div>

                {/* Hidden fields so optionsStorage can sync them */}
                <input type="hidden" name="oauth2AccessToken" />
                <input type="hidden" name="oauth2RefreshToken" />
                <input type="hidden" name="oauth2TokenExpiresAt" />

                <div className="flex items-center gap-2">
                    {/* These buttons are picked up by webext-options-sync for import/export */}
                    <button type="button" className="js-export inline-flex items-center px-3 py-1 border rounded-4xl bg-sky-500 hover:bg-sky-700 text-white">{i18n.t('forms.buttons.export')}</button>
                    <button type="button" className="js-import inline-flex items-center px-3 py-1 border rounded-4xl bg-sky-500 hover:bg-sky-700 text-white">{i18n.t('forms.buttons.import')}</button>
                    <div className="ml-auto text-sm text-gray-600">{status}</div>
                </div>
            </form>
        </div>
    );
}

export default App;

