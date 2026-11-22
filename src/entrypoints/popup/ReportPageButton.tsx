import React from "react";
import { i18n } from "#imports";
import { Flag } from "lucide-react";
import { sendMessage } from "@/lib/messaging";
import { useServerFeatures } from "@/lib/useServerFeatures";
import { secondaryButtonClass } from "@/components/settings/fields";

/** "Report a problem with this page" for the active http(s) tab, when the server accepts reports. */
export function ReportPageButton() {
    const { failureReports } = useServerFeatures();
    const [tab, setTab] = React.useState<{ id?: number; url: string } | null>(null);

    React.useEffect(() => {
        browser.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
            setTab(active?.url && /^https?:\/\//i.test(active.url) ? { id: active.id, url: active.url } : null);
        });
    }, []);

    if (!failureReports || !tab) {
        return null;
    }

    const report = async () => {
        await sendMessage("openReportForm", { url: tab.url, tabId: tab.id });
        window.close();
    };

    return (
        <button type="button" className={`${secondaryButtonClass} gap-1.5`} onClick={report}>
            <Flag className="w-3.5 h-3.5" /> {i18n.t("report.pageAction")}
        </button>
    );
}
