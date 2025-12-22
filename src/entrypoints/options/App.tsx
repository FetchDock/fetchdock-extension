import React, { useRef, useEffect, useState } from "react";
import { i18n } from "#imports";
import optionsStorage from "@/utils/optionsStorage";
import { sendMessage } from "@/lib/messaging";

function App() {
    const formRef = useRef<HTMLFormElement | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        const form = formRef.current;
        if (!form) return;

        // Wire the form to optionsStorage so it loads defaults and auto-saves
        optionsStorage.syncForm(form).catch((err) => {
            // If syncForm fails, show an error in the UI
            console.error('optionsStorage.syncForm failed', err);
            setStatus(i18n.t('messages.options.initializationFailed'));
        });

        // Listen to custom events emitted by webext-options-sync when save succeeds/fails
        const onSaveSuccess = () => {
            setStatus(i18n.t('messages.options.savedSuccessfully'));
            // clear status after a short delay
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

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-8 ring shadow-xl ring-gray-900/5">
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

                <div className="mb-4">
                    <label htmlFor="apiKey" className="block text-gray-900 dark:text-white mt-5 text-base font-medium tracking-tight">{i18n.t('forms.options.labels.apiKey')}</label>
                    <input
                        type="text"
                        id="apiKey"
                        name="apiKey"
                        className="mt-1 ml-0 border border-gray-300 rounded px-2 py-1 w-full"
                    />
                    <span className="text-sm text-gray-600 mt-1">
                        {i18n.t('forms.options.help.apiKey')}
                    </span>
                </div>

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