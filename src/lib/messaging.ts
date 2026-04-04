import {WxtAppConfig, OAuth2AuthResult, DownloadJobDTO, AcceptedDownloadJob, ApiTestResult, RejectedDownloadJob, DownloadJobFinished} from '@/lib/types';
import type { DownloadJob } from '@/lib/types';
import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
    getSettings(): WxtAppConfig;
    updateSettings(settings: Partial<WxtAppConfig>): WxtAppConfig;
    getDownloadJobs(): DownloadJob[];
    sendDownloadJob(job: DownloadJob): void;

    /** Submits a new download job via POST /download_jobs */
    submitDownloadJob(dto: DownloadJobDTO): any;
    /** Fired when the server accepts a submitted download job */
    acceptedDownloadJob(job: AcceptedDownloadJob): void;
    /** Fired when the server rejects a submitted download job (4xx response) */
    rejectedDownloadJob(job: RejectedDownloadJob): void;
    /** Fired when a tracked download job reaches a terminal state via Mercure */
    downloadJobFinished(event: DownloadJobFinished): void;

    /** @deprecated use testApiServiceHostV2 instead */
    testApiServiceHost(host: string): string;
    testApiServiceHostV2(host: string): ApiTestResult;

    /** Returns the oauth2 authorization_endpoint URL for the currently configured host, or throws if not available */
    getOAuth2AuthorizationUrl(host: string): string;

    /** Stores oauth2 tokens returned from the popup auth flow */
    storeOAuth2Tokens(result: OAuth2AuthResult): boolean;

    /** Clears all stored oauth2 tokens (logout) */
    revokeOAuth2Tokens(): boolean;

    refreshOAuth2Tokens(): Promise<boolean>;

    /** Fired by the oauth-callback content script once it has stored tokens; result mirrors OAuth2AuthResult */
    oauth2CallbackReceived(result: OAuth2AuthResult): void;

    /** Asks the background to open the extension's options page */
    openOptionsPage(): void;

    /** Asks the background to resolve an extension-relative path to a full URL */
    getExtensionPageUrl(path: string): string;

    // test
    testMessage(msg: string): string;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();