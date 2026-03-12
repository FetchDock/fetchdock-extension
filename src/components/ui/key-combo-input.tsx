import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ─── Normalisation helpers ────────────────────────────────────────────────────

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Alt', 'Shift']);

/** Map a KeyboardEvent into a sorted, canonical combo string e.g. "ctrl+shift+k" */
export function eventToCombo(e: KeyboardEvent): string | null {
    // Ignore bare modifier key taps
    if (MODIFIER_KEYS.has(e.key)) return null;

    const parts: string[] = [];
    if (e.ctrlKey)  parts.push('ctrl');
    if (e.metaKey)  parts.push('meta');
    if (e.altKey)   parts.push('alt');
    if (e.shiftKey) parts.push('shift');

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    parts.push(key);

    return parts.join('+');
}

/** Split a stored combo string into display parts e.g. ["Ctrl", "Shift", "K"] */
export function comboToParts(combo: string): string[] {
    return combo.split('+').map(p => {
        if (p === 'ctrl')  return '⌃ Ctrl';
        if (p === 'meta')  return '⌘ Cmd';
        if (p === 'alt')   return '⌥ Alt';
        if (p === 'shift') return '⇧ Shift';
        return p.length === 1 ? p.toUpperCase() : p;
    });
}

/** Returns true when a KeyboardEvent matches a stored combo string */
export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
    const live = eventToCombo(e);
    return live !== null && live === combo;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface KeyComboInputProps {
    value: string;
    onChange: (combo: string) => void;
    disabled?: boolean;
    className?: string;
}

export function KeyComboInput({ value, onChange, disabled, className }: KeyComboInputProps) {
    const [recording, setRecording] = useState(false);
    const [liveLabel, setLiveLabel] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const stopRecording = useCallback(() => {
        setRecording(false);
        setLiveLabel(null);
    }, []);

    const startRecording = useCallback(() => {
        if (disabled) return;
        setRecording(true);
        setLiveLabel(null);
        // Focus so blur detection works
        containerRef.current?.focus();
    }, [disabled]);

    useEffect(() => {
        if (!recording) return;

        const onKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const combo = eventToCombo(e);
            if (!combo) {
                // Show modifiers-so-far as live feedback
                const parts: string[] = [];
                if (e.ctrlKey)  parts.push('ctrl');
                if (e.metaKey)  parts.push('meta');
                if (e.altKey)   parts.push('alt');
                if (e.shiftKey) parts.push('shift');
                setLiveLabel(parts.length ? parts.join('+') + '+…' : null);
                return;
            }

            // Escape cancels without saving
            if (e.key === 'Escape') { stopRecording(); return; }

            onChange(combo);
            stopRecording();
        };

        const onBlur = () => stopRecording();

        document.addEventListener('keydown', onKeyDown, true);
        containerRef.current?.addEventListener('blur', onBlur);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            containerRef.current?.removeEventListener('blur', onBlur);
        };
    }, [recording, onChange, stopRecording]);

    const parts = value ? comboToParts(value) : [];

    return (
        <div
            ref={containerRef}
            tabIndex={disabled ? -1 : 0}
            role="button"
            data-key-combo-input
            aria-label="Key combo input — click to record a new shortcut"
            onClick={recording ? stopRecording : startRecording}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') startRecording(); }}
            className={cn(
                'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm',
                'cursor-pointer select-none transition-colors focus:outline-none',
                recording
                    ? 'border-primary bg-primary/5 ring-1 ring-primary animate-pulse'
                    : 'border-input bg-background hover:bg-accent hover:text-accent-foreground',
                disabled && 'opacity-50 pointer-events-none',
                className
            )}
        >
            {recording ? (
                <span className="text-muted-foreground italic text-xs">
                    {liveLabel ?? 'Press keys…'}
                </span>
            ) : (
                <>
                    {parts.map((p, i) => (
                        <React.Fragment key={i}>
                            <kbd className="pointer-events-none inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">
                                {p}
                            </kbd>
                            {i < parts.length - 1 && (
                                <span className="text-muted-foreground text-xs">+</span>
                            )}
                        </React.Fragment>
                    ))}
                    {!disabled && (
                        <span className="ml-1 text-xs text-muted-foreground">(click to change)</span>
                    )}
                </>
            )}
        </div>
    );
}

