import React, { useState } from 'react';
import { HardDrive, Activity, Settings, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DownloadersPanel } from '@/components/dashboard/resources/DownloadersPanel';
import { DownloadJobEventsPanel } from '@/components/dashboard/resources/DownloadJobEventsPanel';

// ─── Navigation definition ──────────────────────────────────────────────────
// To add a new resource: add one entry here. No other changes needed.

interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    panel: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
    {
        id: 'downloaders',
        label: 'Downloaders',
        icon: <HardDrive className="w-4 h-4" />,
        panel: <DownloadersPanel />,
    },
    {
        id: 'download-events',
        label: 'Download Events',
        icon: <Activity className="w-4 h-4" />,
        panel: <DownloadJobEventsPanel />,
    },
];

// ─── Dashboard App ───────────────────────────────────────────────────────────

function App() {
    const [activeId, setActiveId] = useState<string>(NAV_ITEMS[0].id);
    const active = NAV_ITEMS.find(n => n.id === activeId) ?? NAV_ITEMS[0];

    const openOptions = () => {
        browser.runtime.openOptionsPage();
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
                {/* Top bar */}
                <header className="h-14 shrink-0 flex items-center px-6 border-b border-border">
                    <h1 className="text-sm font-semibold text-foreground">{active.label}</h1>
                </header>

                {/* Panel area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {NAV_ITEMS.map(item => (
                        <div
                            key={item.id}
                            className={cn(
                                'h-full',
                                activeId === item.id ? 'block' : 'hidden'
                            )}
                        >
                            {item.panel}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

export default App;

