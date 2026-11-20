import React from "react";
import { i18n } from "#imports";
import { sendMessage } from "@/lib/messaging";
import optionsStorage from "@/utils/optionsStorage";
import type { SiteResolution, UserSiteSettings, UserSiteSettingsWrite } from "@/api/schemas";
import { Badge } from "@/components/ui/badge";
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

type SiteOverrides = Pick<UserSiteSettingsWrite, "sendCookies" | "sendUserAgent" | "sendReferrer" | "downloader" | "downloaderOptions">;

function pickOverrides(settings: UserSiteSettings): SiteOverrides {
    return {
        sendCookies: settings.sendCookies ?? null,
        sendUserAgent: settings.sendUserAgent ?? null,
        sendReferrer: settings.sendReferrer ?? null,
        downloader: settings.downloader ?? null,
        downloaderOptions: settings.downloaderOptions ?? null,
    };
}

function onOff(value: boolean | undefined): string {
    return value ? i18n.t("settings.triState.on") : i18n.t("settings.triState.off");
}

function SiteOverridesEditor({ slug, downloaders, effectiveDownloader, onChanged }: {
    slug: string;
    downloaders: string[];
    effectiveDownloader: string | null | undefined;
    onChanged: () => void;
}) {
    const [value, setValue] = React.useState<SiteOverrides | null>(null);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [saveState, runSave] = useSaveState();

    const load = React.useCallback(() => {
        sendMessage("getUserSiteSettings", slug)
            .then((s) => setValue(pickOverrides(s)))
            .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
    }, [slug]);

    React.useEffect(load, [load]);

    if (loadError) return <p className="text-sm text-red-600">{i18n.t("settings.failed", [loadError])}</p>;
    if (!value) return <p className="text-sm text-gray-600">{i18n.t("settings.loading")}</p>;

    const update = (patch: Partial<SiteOverrides>) => setValue({ ...value, ...patch });

    // PUT replaces all of the site's overrides
    const put = async (overrides: SiteOverrides) => {
        const saved = await sendMessage("putUserSiteSettings", { slug, settings: overrides });
        setValue(pickOverrides(saved));
        onChanged();
    };

    const optionsDownloader = value.downloader ?? effectiveDownloader ?? null;

    return (
        <div className="space-y-1">
            <SettingRow label={i18n.t("settings.fields.sendCookies")} htmlFor="site-cookies">
                <TriStateSelect id="site-cookies" value={value.sendCookies} onChange={(v) => update({ sendCookies: v })} />
            </SettingRow>
            <SettingRow label={i18n.t("settings.fields.sendUserAgent")} htmlFor="site-ua">
                <TriStateSelect id="site-ua" value={value.sendUserAgent} onChange={(v) => update({ sendUserAgent: v })} />
            </SettingRow>
            <SettingRow label={i18n.t("settings.fields.sendReferrer")} htmlFor="site-referrer">
                <TriStateSelect id="site-referrer" value={value.sendReferrer} onChange={(v) => update({ sendReferrer: v })} />
            </SettingRow>
            <SettingRow label={i18n.t("settings.fields.downloader")} htmlFor="site-downloader">
                <DownloaderSelect id="site-downloader" value={value.downloader} downloaders={downloaders}
                                  onChange={(v) => update({ downloader: v })} />
            </SettingRow>
            <div className="flex items-center gap-2 pt-1">
                <button type="button" className={buttonClass} disabled={saveState.status === "saving"}
                        onClick={() => runSave(() => put(value))}>
                    {i18n.t("settings.save")}
                </button>
                <button type="button" className={secondaryButtonClass} disabled={saveState.status === "saving"}
                        onClick={() => runSave(async () => {
                            await sendMessage("resetUserSiteSettings", slug);
                            load();
                            onChanged();
                        })}>
                    {i18n.t("settings.reset")}
                </button>
                <SaveStatus state={saveState} />
            </div>

            {optionsDownloader && (
                <details className="pt-2">
                    <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                        {i18n.t("settings.site.downloaderOptions")} <span className="font-mono text-xs">({optionsDownloader})</span>
                    </summary>
                    <div className="pt-2">
                        <DownloaderOptionsEditor
                            downloader={optionsDownloader}
                            initial={value.downloaderOptions?.[optionsDownloader]}
                            idPrefix="site"
                            onSave={(options) => {
                                const all = { ...(value.downloaderOptions ?? {}) };
                                if (options) {
                                    all[optionsDownloader] = options;
                                } else {
                                    delete all[optionsDownloader];
                                }
                                return put({ ...value, downloaderOptions: Object.keys(all).length > 0 ? all : null });
                            }}
                        />
                    </div>
                </details>
            )}
        </div>
    );
}

/** Resolves the active tab's URL and shows its site, effective settings and the user's per-site overrides. */
export function SitePanel() {
    const [tabUrl, setTabUrl] = React.useState<string | null | undefined>(undefined);
    const [resolution, setResolution] = React.useState<SiteResolution | null | undefined>(undefined);
    const [useServerSettings, setUseServerSettings] = React.useState(false);

    const resolve = React.useCallback((url: string, force = false) => {
        sendMessage("resolveSite", { url, force }).then(setResolution).catch(() => setResolution(null));
    }, []);

    React.useEffect(() => {
        optionsStorage.getAll().then((opts) => setUseServerSettings(!!opts.useServerSettings && !!opts.oauth2AccessToken));
        browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
            const url = tab?.url && /^https?:\/\//i.test(tab.url) ? tab.url : null;
            setTabUrl(url);
            if (url) resolve(url);
        });
    }, [resolve]);

    const openOptions = () => sendMessage("openOptionsPage", undefined);

    if (tabUrl === null) {
        return <p className="text-sm text-gray-600 dark:text-gray-300">{i18n.t("settings.site.noPage")}</p>;
    }
    if (tabUrl === undefined || resolution === undefined) {
        return <p className="text-sm text-gray-600 dark:text-gray-300">{i18n.t("settings.loading")}</p>;
    }
    if (resolution === null || !resolution.site) {
        return (
            <div className="space-y-2">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                    {resolution === null ? i18n.t("settings.site.unavailable") : i18n.t("settings.site.unsupported")}
                </p>
                <button type="button" className={secondaryButtonClass} onClick={openOptions}>
                    {i18n.t("settings.site.openOptions")}
                </button>
            </div>
        );
    }

    const { site, extractors = [], effectiveSettings, requestContext } = resolution;
    const downloaders = [...new Set(extractors.map((e) => e.downloader).filter((d): d is string => !!d))];

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{site.name ?? site.slug}</h2>
                <p className="text-xs text-gray-500">{resolution.host}</p>
            </div>

            <div>
                <p className="text-xs uppercase text-gray-500">{i18n.t("settings.site.extractors")}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                    {extractors.map((e) => (
                        <Badge key={`${e.downloader}:${e.key}`} variant={e.downloader === effectiveSettings?.downloader ? "default" : "secondary"}>
                            {e.downloader} · {e.key}
                        </Badge>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-xs uppercase text-gray-500">{i18n.t("settings.site.effective")}</p>
                <ul className="text-sm text-gray-800 dark:text-gray-200 mt-1">
                    <li>{i18n.t("settings.fields.downloader")}: <span className="font-mono">{effectiveSettings?.downloader ?? "—"}</span></li>
                    <li>{i18n.t("settings.fields.sendCookies")}: {onOff(requestContext?.cookies)}</li>
                    <li>{i18n.t("settings.fields.sendUserAgent")}: {onOff(requestContext?.userAgent)}</li>
                    <li>{i18n.t("settings.fields.sendReferrer")}: {onOff(requestContext?.referrer)}</li>
                </ul>
            </div>

            <div>
                <p className="text-xs uppercase text-gray-500 mb-1">{i18n.t("settings.site.overrides")}</p>
                {useServerSettings && site.slug ? (
                    <SiteOverridesEditor slug={site.slug} downloaders={downloaders}
                                         effectiveDownloader={effectiveSettings?.downloader}
                                         onChanged={() => resolve(tabUrl, true)} />
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600 dark:text-gray-300">{i18n.t("settings.site.enableServerSettings")}</p>
                        <button type="button" className={secondaryButtonClass} onClick={openOptions}>
                            {i18n.t("settings.site.openOptions")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
