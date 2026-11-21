import React from "react";
import { i18n } from "#imports";
import { sendMessage } from "@/lib/messaging";
import optionsStorage from "@/utils/optionsStorage";
import type { SiteResolution } from "@/api/schemas";
import { Badge } from "@/components/ui/badge";
import { secondaryButtonClass } from "@/components/settings/fields";
import { SiteOverridesEditor } from "@/components/settings/SiteOverridesEditor";

function onOff(value: boolean | undefined): string {
    return value ? i18n.t("settings.triState.on") : i18n.t("settings.triState.off");
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
