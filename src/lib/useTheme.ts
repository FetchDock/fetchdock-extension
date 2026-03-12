import { useCallback, useEffect, useState } from 'react';
import optionsStorage from '@/utils/optionsStorage';
import type { Theme } from '@/lib/types';

/** Resolves 'system' to the actual OS preference */
function resolveTheme(theme: Theme): 'light' | 'dark' {
    if (theme !== 'system') return theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply/remove the `dark` class on <html> */
function applyTheme(theme: Theme) {
    const resolved = resolveTheme(theme);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
}

/**
 * Hook that:
 *  - Reads the persisted theme from optionsStorage on mount
 *  - Applies it immediately to <html>
 *  - Watches the OS preference when theme === 'system'
 *  - Returns [theme, setTheme] — setTheme persists and applies in one call
 */
export function useTheme(): [Theme, (t: Theme) => void] {
    const [theme, setThemeState] = useState<Theme>('system');

    // Load from storage and apply on mount
    useEffect(() => {
        optionsStorage.getAll().then(opts => {
            const stored = (opts.theme as Theme | undefined) ?? 'system';
            setThemeState(stored);
            applyTheme(stored);
        });

        // React to changes made in another page (e.g. options → dashboard live update)
        optionsStorage.onChanged(opts => {
            if (opts.theme) {
                const t = opts.theme as Theme;
                setThemeState(t);
                applyTheme(t);
            }
        });
    }, []);

    // Watch OS preference changes when in 'system' mode
    useEffect(() => {
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme('system');
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t);
        applyTheme(t);
        optionsStorage.set({ theme: t });
    }, []);

    return [theme, setTheme];
}

