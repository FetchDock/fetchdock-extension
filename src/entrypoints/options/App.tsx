import React, { useRef, useEffect, useState } from "react";
import { i18n } from "#imports";
import optionsStorage from "@/utils/optionsStorage";

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
        <div className="m-10">
            <form ref={formRef}>
                <div className="mb-4">
                    <label htmlFor="downloadRouterServerHost" className="font-medium block">
                        {i18n.t('forms.options.labels.downloadRouterServerHost')}
                    </label>
                    <input
                        type="text"
                        id="downloadRouterServerHost"
                        name="downloadRouterServerHost"
                        className="mt-1 ml-0 border border-gray-300 rounded px-2 py-1 w-full"
                    />
                </div>

                <div className="mb-2">
                    <label className="font-medium">
                        <input type="checkbox" id="sendCookies" name="sendCookies" className="mr-2" />
                        {i18n.t('forms.options.labels.sendCookies')}
                    </label>
                </div>

                <div className="mb-2">
                    <label className="font-medium">
                        <input type="checkbox" id="sendUserAgent" name="sendUserAgent" className="mr-2" />
                        {i18n.t('forms.options.labels.sendUserAgent')}
                    </label>
                </div>

                <div className="mb-4">
                    <label className="font-medium">
                        <input type="checkbox" id="sendReferrer" name="sendReferrer" className="mr-2" />
                        {i18n.t('forms.options.labels.sendReferrer')}
                    </label>
                </div>

                <div className="mb-4">
                    <label htmlFor="apiKey" className="font-medium block">{i18n.t('forms.options.labels.apiKey')}</label>
                    <input
                        type="text"
                        id="apiKey"
                        name="apiKey"
                        className="mt-1 ml-0 border border-gray-300 rounded px-2 py-1 w-full"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {/* These buttons are picked up by webext-options-sync for import/export */}
                    <button type="button" className="js-export inline-flex items-center px-3 py-1 border rounded bg-gray-100">{i18n.t('forms.buttons.export')}</button>
                    <button type="button" className="js-import inline-flex items-center px-3 py-1 border rounded bg-gray-100">{i18n.t('forms.buttons.import')}</button>
                    <div className="ml-auto text-sm text-gray-600">{status}</div>
                </div>
            </form>
        </div>
    );
}

export default App;