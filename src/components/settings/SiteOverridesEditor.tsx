import React from "react";
import { i18n } from "#imports";
import { sendMessage } from "@/lib/messaging";
import type { UserSiteSettings, UserSiteSettingsWrite } from "@/api/schemas";
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

export type SiteOverrides = Pick<UserSiteSettingsWrite, "sendCookies" | "sendUserAgent" | "sendReferrer" | "downloader" | "downloaderOptions">;

export function pickOverrides(settings: UserSiteSettings): SiteOverrides {
    return {
        sendCookies: settings.sendCookies ?? null,
        sendUserAgent: settings.sendUserAgent ?? null,
        sendReferrer: settings.sendReferrer ?? null,
        downloader: settings.downloader ?? null,
        downloaderOptions: settings.downloaderOptions ?? null,
    };
}

/** Edits the user's server-side overrides for one site (PUT / DELETE /users/settings/sites/{slug}). */
export function SiteOverridesEditor({ slug, downloaders, effectiveDownloader, onChanged }: {
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
