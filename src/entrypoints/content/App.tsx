import * as React from "react";
import { Toast } from "radix-ui";
import { onMessage } from "@/lib/messaging";
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
    open: boolean;
}

// How long each toast stays visible (ms)
const TOAST_DURATION = 5000;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

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
            addToast({
                type: "rejected",
                title: `Link rejected (${status})`,
                description: serverMsg ?? uri,
            });
        });

        // ------------------------------------------------------------------
        // downloadJobFinished — job reached a terminal state via Mercure
        // ------------------------------------------------------------------
        const unsubFinished = onMessage("downloadJobFinished", async (message) => {
            const opts = await optionsStorage.getAll();
            if (!opts.notifyOnJobFinished) return;

            const { state, uri } = message.data;
            const stateLabel: Record<number | string, string> = {
                3: "completed",
                4: "failed",
                5: "cancelled",
            };

            addToast({
                type: "finished",
                title: `Download ${stateLabel[state as number] ?? "finished"}`,
                description: uri,
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
