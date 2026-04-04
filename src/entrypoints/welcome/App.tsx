import React, { useState, useEffect, useRef } from 'react';
import optionsStorage from "@/utils/optionsStorage.ts";
import { sendMessage } from "@/lib/messaging.ts";
import { useTheme } from "@/lib/useTheme.ts";
import { ThemeToggle } from "@/components/ui/theme-toggle.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import { i18n } from "../../../.wxt/i18n";
import {  CircleCheckBig, CircleX} from "lucide-react";
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiTestResult } from "@/lib/types";
import { type CarouselApi } from "@/components/ui/carousel";

function App() {
    const formRef = useRef<HTMLFormElement | null>(null);
    const [apiStatus, setApiStatus] = useState<ApiTestResult | null>(null);
    const [theme, setTheme] = useTheme();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const popupRef = useRef<Window | null>(null)
    const [carousel, setCarousel] = useState<CarouselApi>();

    const openDashboard = async () => {
        const url = await sendMessage("getExtensionPageUrl", "/dashboard.html");
        window.open(url);
    }

    useEffect(() => {
        const form = formRef.current;
        if (!form) return;

        optionsStorage.syncForm(form).catch((err) => {
            console.error("Error syncing form with options storage:", err);
        });

        optionsStorage.getAll().then((opts) => {
            setIsAuthenticated(!!opts.oauth2AccessToken);
        });

        // React to token changes written by the background worker.
        optionsStorage.onChanged((newOpts) => {
            const authenticated = !!newOpts.oauth2AccessToken;
            setIsAuthenticated(authenticated);
            if (authenticated) {
                popupRef.current = null;
                carousel?.scrollNext(false)
            }
        });

        const onSaveError = (e: Event) => {
            console.error('Save error', e);
        };

        form.addEventListener('options-sync:save-error', onSaveError as EventListener);

        return () => {
            form.removeEventListener('options-sync:save-error', onSaveError as EventListener);
        };
    }, []);

    const handleAuthenticate = async () => {
        const hostInput = formRef.current?.elements.namedItem('downloadRouterServerHost') as HTMLInputElement;
        const host = hostInput?.value?.trim();

        let authUrl: string;
        try {
            authUrl = await sendMessage("getOAuth2AuthorizationUrl", host);
        } catch (err) {
            return;
        }

        const popup = window.open(
            authUrl,
            'oauth2-auth',
            'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        if (!popup) {
            return;
        }

        popupRef.current = popup;
    };

    const isValidUrl = (urlString: string): boolean => {
        try {
            new URL(urlString);
            return true;
        } catch (err) {
            return false;
        }
    }

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
                </div>
            </div>

            <form ref={formRef}>
                <div className="mx-auto max-w-2xl pb-16 sm:pb-16 lg:pb-16">
                    <Carousel setApi={setCarousel}>
                        <CarouselContent className={"w-full place-items-center"}>
                            <CarouselItem key={1}>
                                <div className="p-1">
                                    <Card className={"w-full"}>
                                        <CardHeader>
                                            <CardTitle>Setup FetchDock connection</CardTitle>
                                            <CardDescription>
                                                Enter your FetchDock server host below to connect to your FetchDock server.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className={"flex flex-col gap-6"}>
                                                <div className={"grid gap-2"}>
                                                    <label htmlFor="downloadRouterServerHost">
                                                        {i18n.t('forms.options.labels.downloadRouterServerHost')}
                                                    </label>
                                                    <Field orientation={"horizontal"}>
                                                        <Input
                                                            type="text"
                                                            id="downloadRouterServerHost"
                                                            name="downloadRouterServerHost"
                                                            placeholder="https://demo.fetchdock.dev"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            disabled={!isValidUrl(formRef.current?.elements.namedItem('downloadRouterServerHost')?.value || '')}
                                                            onClick={
                                                                async () => {
                                                                    const hostInput = formRef.current?.elements.namedItem('downloadRouterServerHost') as HTMLInputElement;
                                                                    const host = hostInput.value;

                                                                    try {
                                                                        const response = await sendMessage("testApiServiceHostV2", host);
                                                                        setApiStatus(response);
                                                                    } catch (err) {
                                                                        console.error('Error testing server connection:', err);
                                                                    }

                                                                }
                                                            }
                                                        >Test</Button>
                                                    </Field>
                                                </div>
                                                <div className={"grid gap-2 size-full"}>
                                                <span className="text-sm text-gray-600 mt-1">
                                                    {apiStatus?.success != null ? (
                                                        apiStatus?.success == true ? (
                                                            <span className="text-green-600">
                                                                <div className={"flex-col gap-1"}>
                                                                    <CircleCheckBig className="inline-block h-5 w-5 mr-1 accent-green-600 float-left" aria-hidden="true" />
                                                                </div>
                                                                <div className={"flex flex-col gap-1"}>
                                                                    <span className={"grid gap-2"}>
                                                                        Version: {apiStatus.version}
                                                                    </span>
                                                                    <span className={"grid gap-2"}>
                                                                        Auth mode: {apiStatus.authMode}
                                                                    </span>
                                                                </div>
                                                            </span>
                                                        ) : (
                                                            <span className="text-red-600">
                                                                <div className={"flex-col gap-1"}>
                                                                    <CircleX className="inline-block h-5 w-5 mr-1 accent-red-600 float-left" aria-hidden="true" />
                                                                </div>
                                                                <div className={"flex flex-col gap-1"}>
                                                                    <span className="text-red-600">{apiStatus?.message}</span>
                                                                </div>
                                                            </span>
                                                        )
                                                    ):(<></>)}
                                                </span>
                                                </div>
                                                <div className={"grid gap-2"}>
                                                    <Button
                                                        variant="outline"
                                                        disabled={!isValidUrl(formRef.current?.elements.namedItem('downloadRouterServerHost')?.value || '') || (apiStatus && !apiStatus.success)}
                                                        onClick={handleAuthenticate}
                                                    >
                                                        {isAuthenticated ? 'Re-authenticate with OAuth2' : 'Authenticate with OAuth2'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </CarouselItem>
                            <CarouselItem key={2}>
                                <div className="p-1">
                                    <Card className={"w-full"}>
                                        <CardHeader>
                                            <CardTitle>Setup Default send parameters</CardTitle>
                                            <CardDescription>
                                                Enable default send parameters for all requests.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className={"flex flex-col gap-6"}>
                                                <div className={"grid gap-2"}>
                                                    <Field orientation={"horizontal"}>
                                                        <Input
                                                            type="checkbox"
                                                            id="sendCookies"
                                                            name="sendCookies"
                                                            aria-label={i18n.t('forms.options.labels.sendCookies')}
                                                        />
                                                        <label
                                                            htmlFor="downloadRouterServerHost"
                                                            className={"mt-2"}
                                                        >
                                                            {i18n.t('forms.options.labels.sendCookies')}
                                                        </label>
                                                    </Field>
                                                    <Field orientation={"horizontal"}>
                                                        <Input
                                                            type="checkbox"
                                                            id="sendUserAgent"
                                                            name="sendUserAgent"
                                                            aria-label={i18n.t('forms.options.labels.sendUserAgent')}
                                                        />
                                                        <label
                                                            htmlFor="downloadRouterServerHost"
                                                            className={"mt-2"}
                                                        >
                                                            {i18n.t('forms.options.labels.sendUserAgent')}
                                                        </label>
                                                    </Field>
                                                    <Field orientation={"horizontal"}>
                                                        <Input
                                                            type="checkbox"
                                                            id="sendReferrer"
                                                            name="sendReferrer"
                                                            aria-label={i18n.t('forms.options.labels.sendReferrer')}
                                                        />
                                                        <label
                                                            htmlFor="downloadRouterServerHost"
                                                            className={"mt-2"}
                                                        >
                                                            {i18n.t('forms.options.labels.sendReferrer')}
                                                        </label>
                                                    </Field>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </CarouselItem>
                            <CarouselItem>
                                <div className="p-1">
                                    <Card className="w-full">
                                        <CardHeader>
                                            <CardTitle>Good to go!</CardTitle>
                                            <CardDescription>
                                                We're done setting up the essentials.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex items-center justify-center p-6">
                                            <p>
                                                <Button className="ml-4" onClick={openDashboard}>
                                                    Open Dashboard
                                                </Button>
                                            </p>
                                            <p>
                                                <Button className="ml-4" onClick={window.close.bind(window)}>
                                                    Close
                                                </Button>
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </CarouselItem>
                        </CarouselContent>
                        <CarouselPrevious />
                        <CarouselNext />
                    </Carousel>
                </div>

                {/* Hidden fields so optionsStorage can sync them */}
                <input type="hidden" name="oauth2AccessToken" />
                <input type="hidden" name="oauth2RefreshToken" />
                <input type="hidden" name="oauth2TokenExpiresAt" />
            </form>



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