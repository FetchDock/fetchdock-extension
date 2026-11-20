import React from "react";
import { i18n } from "#imports";
import { sendMessage } from "@/lib/messaging";
import type {
    ClientSettings,
    UserDownloaderSettings,
    UserSettings,
    UserSettingsWrite,
} from "@/api/schemas";
import {
    buttonClass,
    DownloaderSelect,
    SaveStatus,
    secondaryButtonClass,
    SettingRow,
    TriStateSelect,
    useSaveState,
} from "@/components/settings/fields";
import { DownloaderOptionsEditor } from "@/components/settings/DownloaderOptionsEditor";

/** Fields shared by the global (/users/settings) and client (/users/clients/{id}/settings) layers. */
type LayerSettings = Pick<UserSettingsWrite, "sendCookies" | "sendUserAgent" | "sendReferrer" | "preferredDownloader">;

function pickLayer(settings: UserSettings | ClientSettings): LayerSettings {
    return {
        sendCookies: settings.sendCookies ?? null,
        sendUserAgent: settings.sendUserAgent ?? null,
        sendReferrer: settings.sendReferrer ?? null,
        preferredDownloader: settings.preferredDownloader ?? null,
    };
}

function Section({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
    return (
        <section className="mt-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{help}</p>
            {children}
        </section>
    );
}

function errorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function LayerEditor({ idPrefix, load, save, downloaders, missingText }: {
    idPrefix: string;
    load: () => Promise<UserSettings | ClientSettings | null>;
    save: (settings: LayerSettings) => Promise<unknown>;
    downloaders: string[];
    missingText?: string;
}) {
    const [value, setValue] = React.useState<LayerSettings | null>(null);
    const [state, setState] = React.useState<"loading" | "ready" | "missing" | { error: string }>("loading");
    const [saveState, runSave] = useSaveState();

    React.useEffect(() => {
        load()
            .then((settings) => {
                if (settings) {
                    setValue(pickLayer(settings));
                    setState("ready");
                } else {
                    setState("missing");
                }
            })
            .catch((err) => setState({ error: errorText(err) }));
    }, [load]);

    if (state === "loading") return <p className="text-sm text-gray-600">{i18n.t("settings.loading")}</p>;
    if (state === "missing") return <p className="text-sm text-gray-600">{missingText}</p>;
    if (typeof state === "object") return <p className="text-sm text-red-600">{i18n.t("settings.failed", [state.error])}</p>;
    if (!value) return null;

    const update = (patch: Partial<LayerSettings>) => setValue({ ...value, ...patch });

    return (
        <div className="max-w-md">
            <SettingRow label={i18n.t("settings.fields.sendCookies")} htmlFor={`${idPrefix}-cookies`}>
                <TriStateSelect id={`${idPrefix}-cookies`} value={value.sendCookies} onChange={(v) => update({ sendCookies: v })} />
            </SettingRow>
            <SettingRow label={i18n.t("settings.fields.sendUserAgent")} htmlFor={`${idPrefix}-ua`}>
                <TriStateSelect id={`${idPrefix}-ua`} value={value.sendUserAgent} onChange={(v) => update({ sendUserAgent: v })} />
            </SettingRow>
            <SettingRow label={i18n.t("settings.fields.sendReferrer")} htmlFor={`${idPrefix}-referrer`}>
                <TriStateSelect id={`${idPrefix}-referrer`} value={value.sendReferrer} onChange={(v) => update({ sendReferrer: v })} />
            </SettingRow>
            <SettingRow label={i18n.t("settings.fields.preferredDownloader")} htmlFor={`${idPrefix}-downloader`}>
                <DownloaderSelect id={`${idPrefix}-downloader`} value={value.preferredDownloader} downloaders={downloaders}
                                  onChange={(v) => update({ preferredDownloader: v })} />
            </SettingRow>
            <div className="flex items-center gap-2 mt-2">
                <button type="button" className={buttonClass} disabled={saveState.status === "saving"}
                        onClick={() => runSave(() => save(value))}>
                    {i18n.t("settings.save")}
                </button>
                <SaveStatus state={saveState} />
            </div>
        </div>
    );
}

function DownloaderRow({ settings, onSaved }: {
    settings: UserDownloaderSettings;
    onSaved: (settings: UserDownloaderSettings) => void;
}) {
    const downloader = settings.downloader ?? "";
    const [enabled, setEnabled] = React.useState<boolean | null>(settings.enabled ?? null);
    const [priority, setPriority] = React.useState<string>(settings.priority == null ? "" : String(settings.priority));
    const [showOptions, setShowOptions] = React.useState(false);
    const [saveState, runSave] = useSaveState();

    // PUT replaces the whole layer, so every save sends all fields
    const put = async (options: UserDownloaderSettings["options"]) => {
        const saved = await sendMessage("putUserDownloaderSettings", {
            downloader,
            settings: { enabled, priority: priority === "" ? null : Number(priority), options },
        });
        onSaved(saved);
    };

    return (
        <div className="border-b border-gray-100 dark:border-gray-700 py-2">
            <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm text-gray-900 dark:text-white w-40 truncate">{downloader}</span>
                <label className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    {i18n.t("settings.fields.enabled")}
                    <TriStateSelect value={enabled} onChange={setEnabled} />
                </label>
                <label className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    {i18n.t("settings.fields.priority")}
                    <input type="number" min={-1000} max={1000} step={1} value={priority}
                           onChange={(e) => setPriority(e.target.value)}
                           className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-20 text-black dark:text-white bg-white dark:bg-gray-700" />
                </label>
                <button type="button" className={buttonClass} disabled={saveState.status === "saving"}
                        onClick={() => runSave(() => put(settings.options ?? null))}>
                    {i18n.t("settings.save")}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setShowOptions(!showOptions)}>
                    {showOptions ? i18n.t("settings.downloaders.hideOptions") : i18n.t("settings.downloaders.options")}
                </button>
                <SaveStatus state={saveState} />
            </div>
            {showOptions && (
                <div className="mt-2 ml-2">
                    <DownloaderOptionsEditor downloader={downloader} initial={settings.options} idPrefix="user-downloader"
                                             onSave={(options) => put(options)} />
                </div>
            )}
        </div>
    );
}

/**
 * Server-side settings: the global layer, this device's client layer and the per-downloader settings.
 * Every request goes through the background service worker.
 */
export function ServerSettings() {
    const [downloaders, setDownloaders] = React.useState<UserDownloaderSettings[] | null>(null);
    const [downloadersError, setDownloadersError] = React.useState<string | null>(null);

    React.useEffect(() => {
        sendMessage("listUserDownloaderSettings", undefined)
            .then(setDownloaders)
            .catch((err) => setDownloadersError(errorText(err)));
    }, []);

    const downloaderIds = (downloaders ?? []).map((d) => d.downloader).filter((d): d is string => !!d);

    const loadUser = React.useCallback(() => sendMessage("getUserSettings", undefined), []);
    const saveUser = React.useCallback((s: LayerSettings) => sendMessage("putUserSettings", s), []);
    const loadClient = React.useCallback(() => sendMessage("getClientSettings", undefined), []);
    const saveClient = React.useCallback((s: LayerSettings) => sendMessage("putClientSettings", s), []);

    return (
        <div>
            <Section title={i18n.t("settings.global.title")} help={i18n.t("settings.global.help")}>
                <LayerEditor idPrefix="global" load={loadUser} save={saveUser} downloaders={downloaderIds} />
            </Section>

            <Section title={i18n.t("settings.client.title")} help={i18n.t("settings.client.help")}>
                <LayerEditor idPrefix="client" load={loadClient} save={saveClient} downloaders={downloaderIds}
                             missingText={i18n.t("settings.client.notRegistered")} />
            </Section>

            <Section title={i18n.t("settings.downloaders.title")} help={i18n.t("settings.downloaders.help")}>
                {downloadersError && <p className="text-sm text-red-600">{i18n.t("settings.failed", [downloadersError])}</p>}
                {!downloaders && !downloadersError && <p className="text-sm text-gray-600">{i18n.t("settings.loading")}</p>}
                {downloaders?.map((d) => (
                    <DownloaderRow key={d.downloader} settings={d}
                                   onSaved={(saved) => setDownloaders((list) =>
                                       (list ?? []).map((item) => (item.downloader === saved.downloader ? saved : item)))} />
                ))}
            </Section>
        </div>
    );
}
