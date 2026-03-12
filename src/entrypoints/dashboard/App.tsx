import React, { useState, useEffect } from 'react';
import { Settings, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/components/dashboard/navItems';
import { CommandPalette } from '@/components/CommandPalette';
import { comboToParts } from '@/components/ui/key-combo-input';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useTheme } from '@/lib/useTheme';
import optionsStorage from '@/utils/optionsStorage';
import { sendMessage } from '@/lib/messaging';

function getInitialId(): string {
    // Support deep-linking via URL hash, e.g. dashboard.html#download-jobs
    const hash = window.location.hash.replace('#', '');
    if (hash && NAV_ITEMS.some(n => n.id === hash)) return hash;
    return NAV_ITEMS[0].id;
}

function App() {
    const [activeId, setActiveId] = useState<string>(getInitialId);
    const active = NAV_ITEMS.find(n => n.id === activeId) ?? NAV_ITEMS[0];
    const [shortcut, setShortcut] = useState('ctrl+k');
    const [theme, setTheme] = useTheme();
    const paletteOpenRef = React.useRef<(() => void) | null>(null);

    useEffect(() => {
        optionsStorage.getAll().then(opts => {
            if (opts.commandPaletteShortcut) setShortcut(opts.commandPaletteShortcut);
        });
        optionsStorage.onChanged(opts => {
            if (opts.commandPaletteShortcut) setShortcut(opts.commandPaletteShortcut);
        });
    }, []);

    // Keep the URL hash in sync so the page can be bookmarked / refreshed
    useEffect(() => {
        window.location.hash = activeId;
    }, [activeId]);

    const openOptions = () => {
        sendMessage('openOptionsPage', undefined);
    };

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">

            {/* Sidebar */}
            <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-card">
                {/* Logo / Title */}
                <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
                    <LayoutDashboard className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm truncate">Download Router</span>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveId(item.id)}
                            className={cn(
                                'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
                                activeId === item.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-2 py-3 border-t border-border">
                    <button
                        onClick={openOptions}
                        className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar — houses the command palette trigger */}
                <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border">
                    <h1 className="text-sm font-semibold text-foreground">{active.label}</h1>
                    <div className="flex items-center gap-2">
                        <ThemeToggle value={theme} onChange={setTheme} />
                        <button
                            onClick={() => paletteOpenRef.current?.()}
                            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                            title={`Open command palette (${comboToParts(shortcut).join('+')})`}
                        >
                            Search commands
                            <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                                {comboToParts(shortcut).join(' + ')}
                            </kbd>
                        </button>
                    </div>
                </header>

                {/* Panel area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {NAV_ITEMS.map(item => (
                        <div
                            key={item.id}
                            className={cn('h-full', activeId === item.id ? 'block' : 'hidden')}
                        >
                            {item.panel}
                        </div>
                    ))}
                </div>
            </main>

            {/* Command palette — always mounted, opened by Ctrl+K or the header button */}
            <CommandPalette onNavigate={setActiveId} openRef={paletteOpenRef} />
        </div>
    );
}

export default App;

