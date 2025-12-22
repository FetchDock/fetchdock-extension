import { defineExtensionMessaging } from "@webext-core/messaging";

export interface DownloadJob {

}

export interface AcceptedDownloadJob extends DownloadJob {
    jobId: string;
    accepted: boolean;
}

export interface WxtAppConfig {
    downloadRouterServerHost?: string;
    sendCookies: boolean;
    sendUserAgent: boolean;
    sendReferrer: boolean;
    apiKey?: string;
}