import * as React from "react";
import { Toast } from "radix-ui";
import { i18n } from "#imports";
import { onMessage, sendMessage } from "@/lib/messaging";
import optionsStorage from "@/utils/optionsStorage";
import "./style.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = "accepted" | "rejected" | "finished";

interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    /** Offers "Report" for this job or URL (only when the server accepts failure reports) */
    report?: { jobUuid?: string; url?: string };
    open: boolean;
}

// How long each toast stays visible (ms)
const TOAST_DURATION = 5000;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Rejections that are about authentication, not the URL */
const AUTH_REJECTIONS = [401, 403];

async function failureReportsEnabled(): Promise<boolean> {
    try {
        return (await sendMessage("getServerFeatures", undefined)).failureReports;
    } catch {
        return false;
    }
}

function createId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// ToastManager
// ---------------------------------------------------------------------------

const ToastManager: React.FC = () => {
    const [toasts, setToasts] = React.useState<ToastItem[]>([]);

    const addToast = React.useCallback((item: Omit<ToastItem, "id" | "open">) => {
        setToasts((prev) => [...prev, { ...item, id: createId(), open: true }]);
    }, []);

    const setOpen = React.useCallback((id: string, open: boolean) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open } : t)));
    }, []);

    React.useEffect(() => {
        // ------------------------------------------------------------------
        // acceptedDownloadJob — server accepted the submitted link
        // ------------------------------------------------------------------
        const unsubAccepted = onMessage("acceptedDownloadJob", async (message) => {
            const opts = await optionsStorage.getAll();
            if (!opts.notifyOnAccepted) return;

            addToast({
                type: "accepted",
                title: "Link accepted",
                description: (message.data as any)?.uri ?? undefined,
            });
        });

        // ------------------------------------------------------------------
        // rejectedDownloadJob — server rejected the submitted link (4xx)
        // ------------------------------------------------------------------
        const unsubRejected = onMessage("rejectedDownloadJob", async (message) => {
            const opts = await optionsStorage.getAll();
            if (!opts.notifyOnRejected) return;

            const { status, message: serverMsg, uri } = message.data;
            const reportable = !!uri && status >= 400 && status < 500 && !AUTH_REJECTIONS.includes(status) && await failureReportsEnabled();
            addToast({
                type: "rejected",
                title: `Link rejected (${status})`,
                description: serverMsg ?? uri,
                report: reportable ? { url: uri } : undefined,
            });
        });

        // ------------------------------------------------------------------
        // downloadJobFinished — job reached a terminal state via Mercure
        // ------------------------------------------------------------------
        const unsubFinished = onMessage("downloadJobFinished", async (message) => {
            const opts = await optionsStorage.getAll();
            if (!opts.notifyOnJobFinished) return;

            const { state, uri, error, jobUuid } = message.data;
            const failed = state === "failed" || state === 3;
            const reportable = failed && !!jobUuid && await failureReportsEnabled();
            // Servers >= 0.7 send "completed" / "failed"; older servers use numeric states
            const stateLabel: Record<number | string, string> = {
                completed: "completed",
                failed: "failed",
                2: "completed",
                3: "failed",
                4: "cancelled",
            };

            addToast({
                type: "finished",
                title: `Download ${stateLabel[state] ?? "finished"}`,
                description: error ? `${uri ?? ""}\n${error}`.trim() : uri,
                report: reportable ? { jobUuid } : undefined,
            });
        });

        return () => {
            unsubAccepted();
            unsubRejected();
            unsubFinished();
        };
    }, [addToast]);

    return (
        <Toast.Provider swipeDirection="right" duration={TOAST_DURATION}>
            {toasts.map((toast) => (
                <Toast.Root
                    key={toast.id}
                    className={`ToastRoot ToastRoot--${toast.type}`}
                    open={toast.open}
                    onOpenChange={(open) => setOpen(toast.id, open)}
                    type="background"
                >
                    <Toast.Title className="ToastTitle">{toast.title}</Toast.Title>
                    {toast.description && (
                        <Toast.Description className="ToastDescription">
                            {toast.description}
                        </Toast.Description>
                    )}
                    {toast.report && (
                        <Toast.Action asChild altText={i18n.t("report.actionTitle")}>
                            <button
                                type="button"
                                className="ToastAction ToastReportButton"
                                onClick={() => {
                                    sendMessage("openReportForm", toast.report!)
                                        .catch((err) => console.error("Failed to open the report form", err));
                                }}
                            >
                                {i18n.t("report.action")}
                            </button>
                        </Toast.Action>
                    )}
                    <Toast.Close aria-label="Close" className="ToastClose">
                        <span aria-hidden>×</span>
                    </Toast.Close>
                </Toast.Root>
            ))}
            <Toast.Viewport className="ToastViewport" />
        </Toast.Provider>
    );
};

export default ToastManager;
