import React from "react";
import { i18n } from "#imports";
import type { DownloaderOptions, DownloaderOptionsSchema } from "@/api/schemas";
import { selectClass } from "@/components/settings/fields";

/** The subset of JSON Schema the server generates for downloader options (see GET /downloaders/{id}/options-schema). */
interface OptionSchema {
    type?: "boolean" | "string" | "integer" | "number" | "array";
    title?: string;
    description?: string;
    enum?: unknown[];
    minimum?: number;
    maximum?: number;
    maxLength?: number;
    maxItems?: number;
    items?: { type?: string; enum?: unknown[] };
    "x-flag"?: string;
    "x-flag-false"?: string;
    "x-metavar"?: string;
    "x-group"?: string;
}

const inputClass =
    "border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-black dark:text-white bg-white dark:bg-gray-700 w-56";

function flagLabel(key: string, schema: OptionSchema): string {
    if (schema.title) return schema.title;
    const flags = [schema["x-flag"], schema["x-flag-false"]].filter(Boolean);
    return flags.length > 0 ? flags.join(" / ") : key;
}

function OptionInput({ id, schema, value, onChange }: {
    id: string;
    schema: OptionSchema;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    if (schema.type === "boolean") {
        const current = value === true ? "1" : value === false ? "0" : "";
        return (
            <select id={id} className={selectClass} value={current}
                    onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "1")}>
                <option value="">{i18n.t("settings.options.unset")}</option>
                <option value="1">{schema["x-flag"] ?? i18n.t("settings.triState.on")}</option>
                <option value="0">{schema["x-flag-false"] ?? i18n.t("settings.triState.off")}</option>
            </select>
        );
    }

    if (schema.enum) {
        return (
            <select id={id} className={selectClass} value={value == null ? "" : String(value)}
                    onChange={(e) => onChange(e.target.value === "" ? undefined : schema.enum!.find((v) => String(v) === e.target.value))}>
                <option value="">{i18n.t("settings.options.unset")}</option>
                {schema.enum.map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
            </select>
        );
    }

    if (schema.type === "integer" || schema.type === "number") {
        return (
            <input id={id} type="number" className={inputClass}
                   step={schema.type === "integer" ? 1 : "any"} min={schema.minimum} max={schema.maximum}
                   placeholder={schema["x-metavar"]}
                   value={typeof value === "number" ? value : ""}
                   onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
        );
    }

    if (schema.type === "array") {
        const lines = Array.isArray(value) ? value.map(String).join("\n") : "";
        return (
            <textarea id={id} className={`${inputClass} h-16`} placeholder={schema["x-metavar"]}
                      title={i18n.t("settings.options.arrayHelp")}
                      value={lines}
                      onChange={(e) => {
                          const items = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
                          const typed = schema.items?.type === "integer" || schema.items?.type === "number" ? items.map(Number) : items;
                          onChange(typed.length > 0 ? typed.slice(0, schema.maxItems ?? typed.length) : undefined);
                      }} />
        );
    }

    return (
        <input id={id} type="text" className={inputClass} maxLength={schema.maxLength}
               placeholder={schema["x-metavar"]}
               value={typeof value === "string" ? value : ""}
               onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)} />
    );
}

/**
 * Renders a downloader's options generically from its JSON Schema, grouped by `x-group`.
 * Unset options are omitted from `value` (= tool default / inherit).
 */
export function SchemaOptionsForm({ schema, value, onChange, idPrefix }: {
    schema: DownloaderOptionsSchema;
    value: DownloaderOptions;
    onChange: (value: DownloaderOptions) => void;
    idPrefix: string;
}) {
    const [filter, setFilter] = React.useState("");
    const properties = Object.entries((schema.properties ?? {}) as Record<string, OptionSchema>);

    if (properties.length === 0) {
        return <p className="text-sm text-gray-600 dark:text-gray-300">{i18n.t("settings.options.noOptions")}</p>;
    }

    const needle = filter.trim().toLowerCase();
    const visible = properties.filter(([key, s]) =>
        !needle || [key, s.title, s.description, s["x-flag"], s["x-flag-false"]].some((t) => t?.toLowerCase().includes(needle)));

    const groups = new Map<string, [string, OptionSchema][]>();
    for (const entry of visible) {
        const group = entry[1]["x-group"] ?? "";
        groups.set(group, [...(groups.get(group) ?? []), entry]);
    }

    const setOption = (key: string, optionValue: unknown) => {
        const next = { ...value };
        if (optionValue === undefined) {
            delete next[key];
        } else {
            next[key] = optionValue;
        }
        onChange(next);
    };

    const setCount = (entries: [string, OptionSchema][]) => entries.filter(([key]) => key in value).length;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <input type="search" className={inputClass} placeholder={i18n.t("settings.options.filter")} value={filter}
                       onChange={(e) => setFilter(e.target.value)} />
                {schema["x-tool-version"] && (
                    <span className="text-xs text-gray-500">{i18n.t("settings.options.toolVersion", [schema["x-tool-version"]])}</span>
                )}
            </div>
            {[...groups.entries()].map(([group, entries]) => (
                <details key={group} open={!!needle || setCount(entries) > 0}
                         className="border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                    <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                        {group || i18n.t("settings.options.general")} <span className="text-gray-500">({setCount(entries)}/{entries.length})</span>
                    </summary>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {entries.map(([key, s]) => (
                            <div key={key} className="flex items-start justify-between gap-4 py-2">
                                <label htmlFor={`${idPrefix}-${key}`} className="text-sm text-gray-900 dark:text-white">
                                    <code className="text-xs">{flagLabel(key, s)}</code>
                                    {s.description && <span className="block text-xs text-gray-600 dark:text-gray-400">{s.description}</span>}
                                </label>
                                <OptionInput id={`${idPrefix}-${key}`} schema={s} value={value[key]}
                                             onChange={(v) => setOption(key, v)} />
                            </div>
                        ))}
                    </div>
                </details>
            ))}
        </div>
    );
}
