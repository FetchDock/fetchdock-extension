import { defineAppConfig } from "#imports";

declare module 'wxt/utils/define-app-config' {
    export interface WxtAppConfig {
        downloadRouterServerHost?: string;
        sendCookies: boolean;
        sendUserAgent: boolean;
        sendReferrer: boolean;
        notifyOnAccepted: boolean;
        notifyOnRejected: boolean;
        notifyOnJobFinished: boolean;
    }
}

export default defineAppConfig({
    // Build-time defaults: use env values when provided, otherwise fall back to the same defaults
    downloadRouterServerHost: import.meta.env.WXT_DOWNLOAD_ROUTER_SERVER_HOST ?? "",
    sendCookies: typeof import.meta.env.WXT_SEND_COOKIES !== 'undefined'
        ? String(import.meta.env.WXT_SEND_COOKIES).toLowerCase() === 'true'
        : false,
    sendUserAgent: typeof import.meta.env.WXT_SEND_USER_AGENT !== 'undefined'
        ? String(import.meta.env.WXT_SEND_USER_AGENT).toLowerCase() === 'true'
        : false,
    sendReferrer: typeof import.meta.env.WXT_SEND_REFERRER !== 'undefined'
        ? String(import.meta.env.WXT_SEND_REFERRER).toLowerCase() === 'true'
        : false,
    notifyOnAccepted: true,
    notifyOnRejected: true,
    notifyOnJobFinished: true,
});
