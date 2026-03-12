import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/types';

interface Option {
    value: Theme;
    icon: React.ReactNode;
    label: string;
}

const OPTIONS: Option[] = [
    { value: 'light',  icon: <Sun  className="w-3.5 h-3.5" />, label: 'Light'  },
    { value: 'dark',   icon: <Moon className="w-3.5 h-3.5" />, label: 'Dark'   },
    { value: 'system', icon: <Monitor className="w-3.5 h-3.5" />, label: 'System' },
];

interface ThemeToggleProps {
    value: Theme;
    onChange: (theme: Theme) => void;
    /** 'icon' shows only the icon (compact, for header use); 'full' shows icon + label */
    variant?: 'icon' | 'full';
    className?: string;
}

export function ThemeToggle({ value, onChange, variant = 'icon', className }: ThemeToggleProps) {
    return (
        <div
            className={cn(
                'inline-flex items-center rounded-md border border-input bg-background p-0.5 gap-0.5',
                className
            )}
            role="group"
            aria-label="Theme"
        >
            {OPTIONS.map(opt => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    title={opt.label}
                    aria-label={opt.label}
                    aria-pressed={value === opt.value}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        value === opt.value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                >
                    {opt.icon}
                    {variant === 'full' && <span>{opt.label}</span>}
                </button>
            ))}
        </div>
    );
}

