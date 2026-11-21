import React from "react";
import { i18n } from "#imports";
import {
    deleteLocalSiteSettings,
    localSiteKey,
    normalizeDomains,
    saveLocalSiteSettings,
    type LocalSiteSettings,
} from "@/lib/localSiteSettings";
import {
    buttonClass,
    SaveStatus,
    secondaryButtonClass,
    SettingRow,
    TriStateSelect,
    useSaveState,
} from "@/components/settings/fields";

const inputClass =
    "border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-black dark:text-white bg-white dark:bg-gray-700 w-56";

/**
 * Edits device-only site settings. For server sites `slug`, `name` and `domains` come from the server;
 * extension-only sites (slug null) can also edit their name and domains.
 */
export function LocalSiteEditor({ site, entry, onChanged, idPrefix = "local-site" }: {
    site: Pick<LocalSiteSettings, "slug" | "name" | "domains">;
    entry: LocalSiteSettings | null | undefined;
    onChanged: (saved: LocalSiteSettings | null) => void;
    idPrefix?: string;
}) {
    const editableIdentity = site.slug === null;
    const [name, setName] = React.useState(entry?.name ?? site.name);
    const [domains, setDomains] = React.useState((entry?.domains ?? site.domains).join(", "));
    const [sendCookies, setSendCookies] = React.useState(entry?.sendCookies ?? null);
    const [sendUserAgent, setSendUserAgent] = React.useState(entry?.sendUserAgent ?? null);
    const [sendReferrer, setSendReferrer] = React.useState(entry?.sendReferrer ?? null);
    const [saveState, runSave] = useSaveState();

    const save = () => runSave(async () => {
        const domainList = editableIdentity ? normalizeDomains(domains) : site.domains;
        if (domainList.length === 0) {
            throw new Error(i18n.t("settings.local.domainsRequired"));
        }
        // Renaming the first domain of an extension-only site changes its key
        if (entry && editableIdentity && localSiteKey(entry) !== localSiteKey({ slug: null, domains: domainList })) {
            await deleteLocalSiteSettings(localSiteKey(entry));
        }
        const saved = await saveLocalSiteSettings({
            slug: site.slug,
            name: (editableIdentity ? name.trim() : site.name) || domainList[0],
            domains: domainList,
            sendCookies,
            sendUserAgent,
            sendReferrer,
        });
        onChanged(saved);
    });

    const remove = () => runSave(async () => {
        if (entry) {
            await deleteLocalSiteSettings(localSiteKey(entry));
        }
        onChanged(null);
    });

    return (
        <div className="max-w-md space-y-1">
            {editableIdentity && (
                <>
                    <SettingRow label={i18n.t("settings.local.name")} htmlFor={`${idPrefix}-name`}>
                        <input id={`${idPrefix}-name`} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
                    </SettingRow>
                    <SettingRow label={i18n.t("settings.local.domains")} htmlFor={`${idPrefix}-domains`}>
                        <input id={`${idPrefix}-domains`} className={inputClass} value={domains} placeholder="example.com, cdn.example.com"
                               onChange={(e) => setDomains(e.target.value)} />
                    </SettingRow>
                </>
            )}
            <SettingRow label={i18n.t("settings.fields.sendCookies")} htmlFor={`${idPrefix}-cookies`}>
                <TriStateSelect id={`${idPrefix}-cookies`} value={sendCookies} onChange={setSendCookies} />
            </SettingRow>
            <SettingRow label={i18n.t("settings.fields.sendUserAgent")} htmlFor={`${idPrefix}-ua`}>
                <TriStateSelect id={`${idPrefix}-ua`} value={sendUserAgent} onChange={setSendUserAgent} />
            </SettingRow>
            <SettingRow label={i18n.t("settings.fields.sendReferrer")} htmlFor={`${idPrefix}-referrer`}>
                <TriStateSelect id={`${idPrefix}-referrer`} value={sendReferrer} onChange={setSendReferrer} />
            </SettingRow>
            <div className="flex items-center gap-2 pt-1">
                <button type="button" className={buttonClass} disabled={saveState.status === "saving"} onClick={save}>
                    {i18n.t("settings.save")}
                </button>
                {entry && (
                    <button type="button" className={secondaryButtonClass} disabled={saveState.status === "saving"} onClick={remove}>
                        {editableIdentity ? i18n.t("settings.local.delete") : i18n.t("settings.reset")}
                    </button>
                )}
                <SaveStatus state={saveState} />
            </div>
        </div>
    );
}
