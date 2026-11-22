import {WxtAppConfig, OAuth2AuthResult, DownloadJobDTO, AcceptedDownloadJob, ApiTestResult, RejectedDownloadJob, DownloadJobFinished} from '@/lib/types';
import type { DownloadJob } from '@/lib/types';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type {
    ClientSettings,
    ClientSettingsWrite,
    CollectionPage,
    DownloaderOptionsSchema,
    FailureReport,
    FailureReportWrite,
    Site,
    SiteDetail,
    SiteResolution,
    UserDownloaderSettings,
    UserDownloaderSettingsWrite,
    UserSettings,
    UserSettingsWrite,
    UserSiteSettings,
    UserSiteSettingsWrite,
} from '@/api/schemas';
import type { ServerFeatures } from '@/lib/wellKnown';
import type { FailureReportContext } from '@/lib/failureReport';

interface ProtocolMap {
    getSettings(): WxtAppConfig;
    updateSettings(settings: Partial<WxtAppConfig>): WxtAppConfig;
    getDownloadJobs(): DownloadJob[];
    sendDownloadJob(job: DownloadJob): void;

    /** Submits a new download job via POST /download_jobs */
    submitDownloadJob(dto: DownloadJobDTO): any;
    /**
     * DELETE /download_jobs/{uuid} and stops its live updates.
     * `deleted: false` = the server didn't know the job (404: already deleted elsewhere).
     */
    deleteDownloadJob(uuid: string): { deleted: boolean };
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

    // ── Sites & settings layers (all requests go through the background) ──

    /** GET /sites/resolve for the URL (cached per host); null when it can't be resolved */
    resolveSite(data: { url: string; force?: boolean }): SiteResolution | null;

    /** GET /users/settings (global layer); also refreshes the local cache */
    getUserSettings(): UserSettings;
    putUserSettings(settings: UserSettingsWrite): UserSettings;

    /** This device's client settings layer; null when the device isn't registered (not authenticated) */
    getClientSettings(): ClientSettings | null;
    putClientSettings(settings: ClientSettingsWrite): ClientSettings;

    listUserDownloaderSettings(): UserDownloaderSettings[];
    putUserDownloaderSettings(data: { downloader: string; settings: UserDownloaderSettingsWrite }): UserDownloaderSettings;

    /** GET /sites (paginated, JSON-LD totals) */
    listSites(params: { page?: number; itemsPerPage?: number; search?: string }): CollectionPage<Site>;
    getSite(slug: string): SiteDetail;
    /** The user's site overrides (sites without overrides are omitted) */
    listUserSiteSettings(): UserSiteSettings[];

    getUserSiteSettings(slug: string): UserSiteSettings;
    putUserSiteSettings(data: { slug: string; settings: UserSiteSettingsWrite }): UserSiteSettings;
    /** Removes the user's overrides for the site (inherit everything) */
    resetUserSiteSettings(slug: string): void;

    getDownloaderOptionsSchema(downloader: string): DownloaderOptionsSchema;

    // ── Failure reports (ADR 0012; all requests go through the background) ──

    /** Optional features from the server's well-known document (cached briefly) */
    getServerFeatures(data?: { force?: boolean }): ServerFeatures;
    /** Opens the report form window for a FAILED job, or for a page URL (`tabId` lets it read the page's referrer) */
    openReportForm(data: { jobUuid?: string; url?: string; tabId?: number }): void;
    /** Gathers what can be reported for a job or URL; the form decides with the user what is sent */
    getFailureReportContext(data: { jobUuid?: string; url?: string; referrer?: string }): FailureReportContext;
    /** POST /users/failure_reports with the body exactly as shown to the user */
    submitFailureReport(body: FailureReportWrite): FailureReport;
    listFailureReports(params: { page?: number; itemsPerPage?: number }): CollectionPage<FailureReport>;
    /** DELETE /users/failure_reports/{id} */
    withdrawFailureReport(id: string): void;

    // test
    testMessage(msg: string): string;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();