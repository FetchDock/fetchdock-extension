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
            <div className="mx-auto max-w-2xl pb-16 sm:pb-16 lg:pb-16">
                <div className="text-center text-gray-400 dark:text-gray-300">
                    <div className="bg-orange-100 border-t-4 border-orange-500 rounded-b text-orange-700 px-4 py-3 shadow-md text-left"
                         role="alert">
                        <div className="flex">
                            <div className="py-1">
                                <svg className="fill-current h-6 w-6 text-teal-500 mr-4"
                                     xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path
                                        d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/>
                                </svg>
                            </div>
                            <div>
                                <p className="font-bold">FetchDock is in early development</p>
                                <p className="text-sm">Since FetchDock is in early development, it is still in beta and may have bugs or missing features. The extension will change with each release while we're working hard on features and improvements.</p>
                            </div>
                        </div>
                    </div>
                    <img src="/logo-v1-full.svg" alt="FetchDock" className="mx-auto h-32 w-auto"/>
                    <p className="mt-8 text-lg font-medium text-pretty sm:text-xl/8">
                        Thank you for installing FetchDock!
                    </p>
                    <p className="mt-8 text-lg font-medium text-pretty sm:text-xl/8">
                        FetchDock extension requires a FetchDock Server instance to be running.
                        Click the button below to setup the extension with your FetchDock server.
                    </p>
                    <p className="mt-8 text-lg font-medium text-pretty sm:text-xl/8">
                        Visit our <a href="https://github.com/fetchdock/fetchdock-extension"
                                     className="text-sky-500 hover:text-sky-400">
                        GitHub repository
                    </a> for more information.
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-x-6">
                        <a href="#" onClick={openOptions}
                           className="rounded-md bg-sky-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">Open
                            Settings</a>
                    </div>
                </div>
            </div>

            <footer className="absolute inset-x-0 py-4 text-center text-sm text-gray-400">
                <p className={"py-2"}>
                    FetchDock is in early development, we're working hard on features and
                    improvements. {/* Visit our <a href="https://github.com/fetchdock/fetchdock-extension/discussions">Github Discussions</a> for feedback and feature requests. */}
                </p>
                <p>
                    FetchDock is an open-source project. Contributions are welcome! Visit our <a
                    href="https://github.com/fetchdock/fetchdock-extension">Github Repository</a> to contribute.
                </p>
                <p className={"py-2"}>
                    &copy; {new Date().getFullYear()} FetchDock. All rights reserved.
                </p>
            </footer>
        </div>
    );
}

export default App;