import React from "react";
import { i18n } from "#imports";

export const selectClass =
    "border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-black dark:text-white bg-white dark:bg-gray-700";
export const buttonClass =
    "inline-flex items-center px-3 py-1 border rounded-4xl bg-sky-500 hover:bg-sky-700 text-white text-sm disabled:opacity-50";
export const secondaryButtonClass =
    "inline-flex items-center px-3 py-1 border rounded-4xl border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm disabled:opacity-50";

/** A nullable boolean setting: null = inherit from the previous layer. */
export function TriStateSelect({ id, value, onChange, disabled }: {
    id?: string;
    value: boolean | null | undefined;
    onChange: (value: boolean | null) => void;
    disabled?: boolean;
}) {
    const current = value == null ? "" : value ? "1" : "0";
    return (
        <select
            id={id}
            className={selectClass}
            value={current}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "1")}
        >
            <option value="">{i18n.t("settings.triState.inherit")}</option>
            <option value="1">{i18n.t("settings.triState.on")}</option>
            <option value="0">{i18n.t("settings.triState.off")}</option>
        </select>
    );
}

/** Downloader picker: empty = no preference (null). */
export function DownloaderSelect({ id, value, downloaders, onChange, disabled }: {
    id?: string;
    value: string | null | undefined;
    downloaders: string[];
    onChange: (value: string | null) => void;
    disabled?: boolean;
}) {
    const options = value && !downloaders.includes(value) ? [...downloaders, value] : downloaders;
    return (
        <select
            id={id}
            className={selectClass}
            value={value ?? ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value || null)}
        >
            <option value="">{i18n.t("settings.defaultDownloader")}</option>
            {options.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
    );
}

export function SettingRow({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-1">
            <label htmlFor={htmlFor} className="text-sm text-gray-900 dark:text-white">{label}</label>
            {children}
        </div>
    );
}

export type SaveState = { status: "idle" | "saving" | "saved" } | { status: "error"; error: string };

export function SaveStatus({ state }: { state: SaveState }) {
    if (state.status === "saving") return <span className="text-sm text-gray-600 dark:text-gray-300">{i18n.t("settings.saving")}</span>;
    if (state.status === "saved") return <span className="text-sm text-green-600 dark:text-green-400">{i18n.t("settings.saved")}</span>;
    if (state.status === "error") return <span className="text-sm text-red-600 dark:text-red-400 whitespace-pre-line">{i18n.t("settings.failed", [state.error])}</span>;
    return null;
}

/** Runs a save action and tracks its state for SaveStatus. */
export function useSaveState(): [SaveState, (action: () => Promise<unknown>) => Promise<boolean>] {
    const [state, setState] = React.useState<SaveState>({ status: "idle" });
    const run = React.useCallback(async (action: () => Promise<unknown>) => {
        setState({ status: "saving" });
        try {
            await action();
            setState({ status: "saved" });
            setTimeout(() => setState((s) => (s.status === "saved" ? { status: "idle" } : s)), 1500);
            return true;
        } catch (err) {
            setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
            return false;
        }
    }, []);
    return [state, run];
}
