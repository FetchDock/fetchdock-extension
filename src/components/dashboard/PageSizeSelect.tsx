import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const PRESETS = [10, 25, 50, 100];
const CUSTOM_VALUE = '__custom__';

interface PageSizeSelectProps {
    value: number;
    onChange: (size: number) => void;
    disabled?: boolean;
    className?: string;
}

export function PageSizeSelect({ value, onChange, disabled, className }: PageSizeSelectProps) {
    // Are we currently showing the custom input instead of the select?
    const isCustom = !PRESETS.includes(value);
    const [showInput, setShowInput] = useState(isCustom);
    const [draft, setDraft]         = useState(isCustom ? String(value) : '');
    const inputRef = useRef<HTMLInputElement>(null);

    const baseClass = cn(
        'h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        'disabled:opacity-50 disabled:pointer-events-none',
        className
    );

    const commit = (raw: string) => {
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 1) {
            onChange(n);
            // If the entered value matches a preset, snap back to the select
            if (PRESETS.includes(n)) setShowInput(false);
        } else {
            // Revert draft to current value on invalid input
            setDraft(String(value));
        }
    };

    if (showInput) {
        return (
            <input
                ref={inputRef}
                type="number"
                min={1}
                value={draft}
                disabled={disabled}
                className={cn(baseClass, 'w-20 [appearance:textfield]')}
                onChange={e => setDraft(e.target.value)}
                onBlur={e => commit(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(draft); }
                    if (e.key === 'Escape') { setShowInput(false); setDraft(''); }
                }}
                title="Rows per page"
                autoFocus
            />
        );
    }

    return (
        <select
            value={value}
            disabled={disabled}
            className={cn(baseClass, 'cursor-pointer pr-6')}
            title="Rows per page"
            onChange={e => {
                if (e.target.value === CUSTOM_VALUE) {
                    setDraft(String(value));
                    setShowInput(true);
                    // Focus the input on next tick
                    setTimeout(() => inputRef.current?.focus(), 0);
                } else {
                    onChange(parseInt(e.target.value, 10));
                }
            }}
        >
            {PRESETS.map(n => (
                <option key={n} value={n}>{n} / page</option>
            ))}
            <option value={CUSTOM_VALUE}>Custom…</option>
        </select>
    );
}

