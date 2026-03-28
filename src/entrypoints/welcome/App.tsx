import React, { useState, useEffect } from 'react';
import {sendMessage} from "@/lib/messaging.ts";
import {useTheme} from "@/lib/useTheme.ts";
import {ThemeToggle} from "@/components/ui/theme-toggle.tsx";

function App() {
    const [theme, setTheme] = useTheme();
    const openDashboard = async () => {
        const url = await sendMessage("getExtensionPageUrl", "/dashboard.html");

        console.log("Opening dashboard at:", url);

        window.open(url);
    }

    const openOptions = () => {
        sendMessage('openOptionsPage', undefined);
    };

    return (
        <div className="relative dark:bg-gray-800 isolate px-6 pt-14 lg:px-8">
            <header className={"absolute inset-x-0 top-0"}>
                <div className={"p-6 flex flex-1 justify-end"}>
                    <ThemeToggle value={theme} onChange={setTheme} variant="icon" />
                </div>
            </header>
            <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
                <div className="text-center text-gray-400 dark:text-gray-300">
                    <img src="/logo-v1-full.svg" alt="FetchDock" className="mx-auto h-16 w-auto" />
                    <p className="mt-8 text-lg font-medium text-pretty sm:text-xl/8">
                        Thank you for installing FetchDock!
                    </p>
                    <p className="mt-8 text-lg font-medium text-pretty sm:text-xl/8">
                        FetchDock extension requires a FetchDock Server instance to be running.
                        Click the button below to setup the extension with your FetchDock server.
                    </p>
                    <p className="mt-8 text-lg font-medium text-pretty sm:text-xl/8">
                        Visit our <a href="https://github.com/fetchdock/fetchdock-extension"
                           className="text-indigo-400 hover:text-indigo-300">
                            GitHub repository
                        </a> for more information.
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-x-6">
                        <a href="#" onClick={openOptions} className="rounded-md bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">Open Settings</a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;