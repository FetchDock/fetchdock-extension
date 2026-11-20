import React from "react";
import { i18n } from "#imports";
import { sendMessage } from "@/lib/messaging";
import type { DownloaderOptions, DownloaderOptionsSchema } from "@/api/schemas";
import { SchemaOptionsForm } from "@/components/settings/SchemaOptionsForm";
import { buttonClass, SaveStatus, useSaveState } from "@/components/settings/fields";

/** Loads a downloader's options schema and edits a set of option values against it. */
export function DownloaderOptionsEditor({ downloader, initial, onSave, idPrefix }: {
    downloader: string;
    initial: DownloaderOptions | null | undefined;
    onSave: (options: DownloaderOptions | null) => Promise<unknown>;
    idPrefix: string;
}) {
    const [schema, setSchema] = React.useState<DownloaderOptionsSchema | null>(null);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [value, setValue] = React.useState<DownloaderOptions>(initial ?? {});
    const [saveState, save] = useSaveState();

    React.useEffect(() => {
        setValue(initial ?? {});
    }, [initial]);

    React.useEffect(() => {
        setSchema(null);
        setLoadError(null);
        sendMessage("getDownloaderOptionsSchema", downloader)
            .then(setSchema)
            .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
    }, [downloader]);

    if (loadError) {
        return <p className="text-sm text-red-600 dark:text-red-400">{i18n.t("settings.failed", [loadError])}</p>;
    }
    if (!schema) {
        return <p className="text-sm text-gray-600 dark:text-gray-300">{i18n.t("settings.loading")}</p>;
    }

    const hasOptions = Object.keys(schema.properties ?? {}).length > 0;

    return (
        <div className="space-y-2">
            <SchemaOptionsForm schema={schema} value={value} onChange={setValue} idPrefix={`${idPrefix}-${downloader}`} />
            {hasOptions && (
                <div className="flex items-center gap-2">
                    <button type="button" className={buttonClass} disabled={saveState.status === "saving"}
                            onClick={() => save(() => onSave(Object.keys(value).length > 0 ? value : null))}>
                        {i18n.t("settings.save")}
                    </button>
                    <SaveStatus state={saveState} />
                </div>
            )}
        </div>
    );
}
