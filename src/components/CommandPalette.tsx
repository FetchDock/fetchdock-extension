"use client"

import * as React from "react"
import {
    Settings,
    KeyRound,
    LayoutDashboard,
    LogOut,
    RefreshCw,
    ExternalLink,
    Sun,
    Moon,
    Monitor,
} from "lucide-react"
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import { NAV_ITEMS } from "@/components/dashboard/navItems"
import { matchesCombo, comboToParts } from "@/components/ui/key-combo-input"
import optionsStorage from "@/utils/optionsStorage"
import { sendMessage } from "@/lib/messaging"
import { useTheme } from "@/lib/useTheme"

const DEFAULT_SHORTCUT = "ctrl+k"

interface CommandPaletteProps {
    onNavigate?: (id: string) => void
    /** If provided, the ref will be set to a function that opens the palette */
    openRef?: React.MutableRefObject<(() => void) | null>
}

export function CommandPalette({ onNavigate, openRef }: CommandPaletteProps) {
    const [open, setOpen] = React.useState(false)
    const [shortcut, setShortcut] = React.useState(DEFAULT_SHORTCUT)
    const [theme, setTheme] = useTheme()

    // Expose open() to the parent via ref
    React.useEffect(() => {
        if (openRef) openRef.current = () => setOpen(true)
        return () => { if (openRef) openRef.current = null }
    }, [openRef])

    // Load shortcut from storage and subscribe to changes
    React.useEffect(() => {
        optionsStorage.getAll().then(opts => {
            if (opts.commandPaletteShortcut) setShortcut(opts.commandPaletteShortcut)
        })
        optionsStorage.onChanged(opts => {
            if (opts.commandPaletteShortcut) setShortcut(opts.commandPaletteShortcut)
        })
    }, [])

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            // Don't trigger while the user is recording a new shortcut
            const active = document.activeElement
            if (active && (active as HTMLElement).closest('[data-key-combo-input]')) return

            if (matchesCombo(e, shortcut)) {
                e.preventDefault()
                setOpen(prev => !prev)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [shortcut])

    const run = (fn: () => void) => {
        setOpen(false)
        setTimeout(fn, 50)
    }

    const openDashboard = async (id?: string) => {
        if (onNavigate && id) {
            onNavigate(id)
        } else {
            const path = `/dashboard.html${id ? `#${id}` : ""}`
            const url = await sendMessage("getExtensionPageUrl", path)
            window.open(url, "_blank")
        }
    }

    const openOptions = () => sendMessage("openOptionsPage", undefined)

    const openAuthentication = async () => {
        const url = await sendMessage("getExtensionPageUrl", "/options.html#authentication")
        window.open(url, "_blank")
    }

    // Build a human-readable shortcut label for display in the trigger button
    const shortcutLabel = comboToParts(shortcut).join(' + ')

    return (
        <>
            {!onNavigate && (
                <p className="text-muted-foreground text-sm">
                    Press{" "}
                    <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
                        {shortcutLabel}
                    </kbd>
                </p>
            )}

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Search commands…" />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>

                    <CommandGroup heading="Dashboard">
                        <CommandItem
                            value="dashboard overview"
                            onSelect={() => run(() => openDashboard())}
                        >
                            <LayoutDashboard />
                            <span>Open Dashboard</span>
                            {!onNavigate && <CommandShortcut><ExternalLink className="w-3 h-3" /></CommandShortcut>}
                        </CommandItem>

                        {NAV_ITEMS.map(item => (
                            <CommandItem
                                key={item.id}
                                value={`dashboard ${item.label} ${item.description ?? ""}`}
                                onSelect={() => run(() => openDashboard(item.id))}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                                {item.description && (
                                    <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
                                        {item.description}
                                    </span>
                                )}
                            </CommandItem>
                        ))}
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Settings">
                        <CommandItem
                            value="settings options preferences"
                            onSelect={() => run(openOptions)}
                        >
                            <Settings />
                            <span>Open Settings</span>
                            <CommandShortcut>⌘,</CommandShortcut>
                        </CommandItem>

                        <CommandItem
                            value="authentication oauth login sign in"
                            onSelect={() => run(openAuthentication)}
                        >
                            <KeyRound />
                            <span>Authentication</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Theme">
                        <CommandItem
                            value="theme light mode"
                            onSelect={() => run(() => setTheme('light'))}
                        >
                            <Sun />
                            <span>Light Mode</span>
                            {theme === 'light' && <CommandShortcut>✓</CommandShortcut>}
                        </CommandItem>
                        <CommandItem
                            value="theme dark mode"
                            onSelect={() => run(() => setTheme('dark'))}
                        >
                            <Moon />
                            <span>Dark Mode</span>
                            {theme === 'dark' && <CommandShortcut>✓</CommandShortcut>}
                        </CommandItem>
                        <CommandItem
                            value="theme system mode os browser follow"
                            onSelect={() => run(() => setTheme('system'))}
                        >
                            <Monitor />
                            <span>System Theme</span>
                            {theme === 'system' && <CommandShortcut>✓</CommandShortcut>}
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Account">
                        <CommandItem
                            value="refresh token oauth2 renew"
                            onSelect={() => run(() => { sendMessage("refreshOAuth2Tokens", undefined) })}
                        >
                            <RefreshCw />
                            <span>Refresh Auth Token</span>
                        </CommandItem>

                        <CommandItem
                            value="revoke logout sign out oauth2"
                            onSelect={() => run(() => { sendMessage("revokeOAuth2Tokens", undefined) })}
                            className="text-destructive data-[selected=true]:text-destructive"
                        >
                            <LogOut />
                            <span>Revoke Authentication</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    )
}
