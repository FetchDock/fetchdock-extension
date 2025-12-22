import optionsStorage from '@/utils/optionsStorage';
import { useAppConfig } from '#imports';
import type { WxtAppConfig } from '@/lib/types';

/**
 * Returns the effective app config by merging the build-time `useAppConfig()` defaults
 * with any runtime values stored via optionsStorage.
 */
export async function getMergedAppConfig(): Promise<WxtAppConfig> {
    const defaults = useAppConfig();
    const stored = await optionsStorage.getAll();
    return { ...defaults, ...stored } as WxtAppConfig;
}

/**
 * Subscribe to options changes. `callback` will be called with (newConfig, oldConfig)
 */
export function subscribeToAppConfigChanges(callback: (newConfig: WxtAppConfig, oldConfig: WxtAppConfig) => void) {
    // optionsStorage.onChanged takes a callback and optional AbortSignal
    // We'll hook into it and call the provided callback with decoded objects
    optionsStorage.onChanged((newOptions, oldOptions) => {
        const defaults = useAppConfig();
        const newConfig = { ...defaults, ...newOptions } as WxtAppConfig;
        const oldConfig = { ...defaults, ...oldOptions } as WxtAppConfig;
        callback(newConfig, oldConfig);
    });
}

