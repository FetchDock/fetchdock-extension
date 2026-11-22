import {
    Configuration,
    DownloaderApi,
    DownloadJobApi,
    DownloadJobEventApi,
    DownloadedFileApi,
    LoginCheckApi,
    SupportedSiteApi,
    VersionApi
} from "@/service/api";
import {getMergedAppConfig, subscribeToAppConfigChanges} from "@/lib/config";
import type {WxtAppConfig, DownloadJobDTO, SubscriptionToken} from "@/lib/types";
import {tokenManager} from "@/lib/tokenManager";
import { fetchDiscovery, resolveEndpoint } from "@/lib/fetchUtils";
import { wellKnownTokenEndpoint } from "@/lib/wellKnown";
import { clientRegistrationItem } from "@/lib/storageItems";
import type {
    Client,
    ClientCreate,
    ClientPreferences,
    ClientSettings,
    ClientSettingsWrite,
    CollectionPage,
    DownloaderOptionsSchema,
    DownloaderVersion,
    DownloadJobEvent,
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
} from "@/api/schemas";

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface JsonRequestOptions {
    query?: Record<string, string>;
    body?: unknown;
    /** Response media type; defaults to application/json */
    accept?: string;
}


/**
 * Small wrapper around the generated OpenAPI client that:
 * - Initializes the generated APIs with runtime configuration (basePath + apiKey)
 * - Keeps configuration in sync when options change
 * - Exposes higher-level convenience methods used by the app
 */
class ApiService {
    private configuration: Configuration = new Configuration();

    // Lazy API instances (recreated whenever configuration changes)
    private downloadJobApi?: DownloadJobApi;
    private downloadJobEventApi?: DownloadJobEventApi;
    private downloadedFileApi?: DownloadedFileApi;
    private versionApi?: VersionApi;
    private supportedSiteApi?: SupportedSiteApi;
    private downloaderApi?: DownloaderApi;
    private loginCheckApi?: LoginCheckApi;

    // Default request options that will be merged into every API call.
    private defaultRequestOptions: any = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/ld+json',
        }
    };

    /** Token endpoint discovered from the server's well-known document */
    private tokenEndpoint: string | null = null;

    private initPromise?: Promise<void> | null = null;

    constructor() {
        this.initPromise = this.init();

        subscribeToAppConfigChanges((newConfig) => {
            this.updateConfigurationFromAppConfig(newConfig);
        });

        this._markPublicApiForTools();
    }

    private _markPublicApiForTools(): void {
        void this.setDefaultRequestOptions;
        void this.setDefaultRequestHeaders;
        void this.submitDownloadJob;
        void this.listDownloadJobs;
        void this.getDownloadJob;
        void this.listSupportedSites;
        void this.listDownloadJobEvents;
        void this.listDownloadedFiles;
        void this.getVersion;
        void this.listDownloaders;
        void this.testHost;
        void this.getOAuth2AuthorizationUrl;
    }

    private async init() {
        const cfg = await getMergedAppConfig();
        this.updateConfigurationFromAppConfig(cfg);
        // Eagerly discover the token endpoint from the well-known document
        await this.discoverTokenEndpoint(cfg);
    }

    /**
     * Fetches the well-known document and caches the OAuth2 token endpoint if present.
     */
    private async discoverTokenEndpoint(cfg: WxtAppConfig): Promise<void> {
        const base = (cfg.downloadRouterServerHost ?? '').replace(/\/+$/, '');
        if (!base) return;
        try {
            const res = await fetchDiscovery(`${base}/.well-known/browser-extension`);
            if (!res.ok) return;
            const data = await res.json();
            const endpoint = wellKnownTokenEndpoint(data);
            if (endpoint) {
                this.tokenEndpoint = resolveEndpoint(endpoint, base);
                console.debug('[ApiService] Discovered token endpoint:', this.tokenEndpoint);
            }
        } catch {
            // Non-fatal — token refresh will simply not be available
        }
    }

    private updateConfigurationFromAppConfig(cfg: WxtAppConfig) {
        const conf: any = {};
        if (cfg.downloadRouterServerHost) {
            conf.basePath = cfg.downloadRouterServerHost.replace(/\/+$/, '');
        }
        // Bearer token is injected per-request via buildAuthOptions() so the
        // configuration doesn't need to know about it statically.
        this.configuration = new Configuration(conf);

        this.downloadJobApi = undefined;
        this.downloadJobEventApi = undefined;
        this.downloadedFileApi = undefined;
        this.versionApi = undefined;
        this.supportedSiteApi = undefined;
        this.downloaderApi = undefined;
        this.loginCheckApi = undefined;
    }

    private async ready() {
        if (this.initPromise) {
            await this.initPromise;
            this.initPromise = null;
        }
    }

    /**
     * Builds request options that include a fresh Bearer token header.
     * Silently skips auth if no token is available.
     */
    private async buildAuthOptions(options?: any): Promise<any> {
        const accessToken = await tokenManager.getAccessToken(this.tokenEndpoint ?? undefined);
        const authHeaders: Record<string, string> = accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {};

        // Enables this device's per-client settings layer on the server
        const clientId = await this.getClientIdForCurrentServer();
        if (clientId) {
            authHeaders['X-Client-Id'] = clientId;
        }

        return this.mergeOptions(this.buildRequestOptions(options), { headers: authHeaders });
    }

    private async getServerBase(): Promise<string> {
        const cfg = await getMergedAppConfig();
        return (cfg.downloadRouterServerHost ?? '').replace(/\/+$/, '');
    }

    /** The registered client id, if it was registered on the currently configured server. */
    private async getClientIdForCurrentServer(): Promise<string | null> {
        const registration = await clientRegistrationItem.getValue();
        if (!registration) {
            return null;
        }
        return registration.server === await this.getServerBase() ? registration.id : null;
    }

    /**
     * Plain JSON request against the configured server (for endpoints not covered by the legacy generated client).
     * Throws `{ status, body }` on non-2xx responses; resolves to null for 204.
     */
    private async requestJson<T>(method: HttpMethod, path: string, options: JsonRequestOptions = {}): Promise<T> {
        await this.ready();
        const base = await this.getServerBase();
        if (!base) {
            throw new Error('No FetchDock server configured');
        }

        const url = new URL(base + path);
        Object.entries(options.query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));

        const headers: Record<string, string> = { Accept: options.accept ?? 'application/json' };
        if (options.body !== undefined) {
            headers['Content-Type'] = method === 'PATCH' ? 'application/merge-patch+json' : 'application/json';
        }

        const init = await this.buildAuthOptions({
            method,
            headers,
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });
        const res = await this.getRuntimeFetch()(url.toString(), init);
        if (!res.ok) {
            throw await this.normalizeApiError(res);
        }
        if (res.status === 204) {
            return null as T;
        }
        return await res.json() as T;
    }

    // Helper to get the global fetch function in a type-safe manner
    private getRuntimeFetch(): (input: string, init?: any) => Promise<Response> {
        // The extension runtime (Firefox/Chrome) exposes fetch on globalThis
        const fn = (globalThis as any).fetch ?? (window as any)?.fetch;
        if (!fn) {
            throw new Error('No fetch implementation available in this environment');
        }
        return fn.bind(globalThis);
    }

    // Public API to update default request options used for every call.
    // Example: apiService.setDefaultRequestHeaders({ 'Content-Type': 'application/json' })
    public setDefaultRequestOptions(options: any) {
        this.defaultRequestOptions = this.mergeOptions(this.defaultRequestOptions, options);
    }

    public setDefaultRequestHeaders(headers: Record<string, string>) {
        this.defaultRequestOptions.headers = Object.assign({}, this.defaultRequestOptions.headers || {}, headers);
    }

    // Internal helper: merge default options with call-specific overrides.
    private mergeOptions(defaults: any, overrides?: any) {
        const merged = Object.assign({}, defaults || {});
        if (overrides) {
            // Shallow merge except for headers which should merge key-by-key
            if (overrides.headers) {
                merged.headers = Object.assign({}, defaults?.headers || {}, overrides.headers);
            }
            // Merge other keys
            Object.keys(overrides).forEach((k) => {
                if (k !== 'headers') {
                    merged[k] = overrides[k];
                }
            });
        }
        return merged;
    }

    private buildRequestOptions(options?: any) {
        return this.mergeOptions(this.defaultRequestOptions, options);
    }

    private getDownloadJobApi() {
        if (!this.downloadJobApi) {
            this.downloadJobApi = new DownloadJobApi(this.configuration, undefined, this.getRuntimeFetch());
        }
        return this.downloadJobApi;
    }

    private getDownloadJobEventApi() {
        if (!this.downloadJobEventApi) {
            this.downloadJobEventApi = new DownloadJobEventApi(this.configuration, undefined, this.getRuntimeFetch());
        }
        return this.downloadJobEventApi;
    }

    private getDownloadedFileApi() {
        if (!this.downloadedFileApi) {
            this.downloadedFileApi = new DownloadedFileApi(this.configuration, undefined, this.getRuntimeFetch());
        }
        return this.downloadedFileApi;
    }

    private getVersionApi() {
        if (!this.versionApi) {
            this.versionApi = new VersionApi(this.configuration, undefined, this.getRuntimeFetch());
        }
        return this.versionApi;
    }

    private getDownloaderApi() {
        if (!this.downloaderApi) {
            this.downloaderApi = new DownloaderApi(this.configuration, undefined, this.getRuntimeFetch());
        }
        return this.downloaderApi;
    }

    private getSupportedSiteApi() {
        if (!this.supportedSiteApi) {
            this.supportedSiteApi = new SupportedSiteApi(this.configuration, undefined, this.getRuntimeFetch());
        }
        return this.supportedSiteApi;
    }

    // ---------------------------------------------------------------------------
    // DownloadJob
    // ---------------------------------------------------------------------------

    /**
     * POST /download_jobs
     * Submits a new download job to the server.
     * @see docs.jsonld #DownloadJob (writeable properties)
     */
    public async submitDownloadJob(dto: DownloadJobDTO): Promise<any> {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions({
                body: JSON.stringify(dto),
                headers: {
                    'Content-Type': 'application/ld+json',
                },
            });
            const res = await this.getDownloadJobApi().apiDownloadJobsPost(opts);
            return await res.json();
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    /** GET /download_jobs */
    public async listDownloadJobs(page?: number, pageSize?: number, options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(this.withPageSize(options, pageSize));
            const res = await this.getDownloadJobApi().apiDownloadJobsGetCollection(page, opts);
            return await res.json();
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    /**
     * DELETE /download_jobs/{uuid} (owner only; soft delete on the server).
     * Resolves to false when the job doesn't exist (404: already deleted or not the user's).
     */
    public async deleteDownloadJob(uuid: string): Promise<boolean> {
        try {
            await this.requestJson<null>('DELETE', `/download_jobs/${encodeURIComponent(uuid)}`);
            return true;
        } catch (err: any) {
            if (err?.status === 404) {
                return false;
            }
            throw err;
        }
    }

    /** GET /download_jobs/{uuid} */
    public async getDownloadJob(uuid: string, options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(options);
            const res = await this.getDownloadJobApi().apiDownloadJobsUuidGet(uuid, opts);
            return await res.json();
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    // ---------------------------------------------------------------------------
    // DownloadJobEvents & DownloadedFiles
    // ---------------------------------------------------------------------------

    public async listDownloadJobEvents(downloadJobUuid: string, page?: number, pageSize?: number, options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(this.withPageSize(options, pageSize));
            const res = await this.getDownloadJobEventApi()
                .apiDownloadJobsDownloadJobUuideventsFormatGetCollection(downloadJobUuid, page, opts);
            return await res.json();
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    public async listDownloadedFiles(downloadJobUuid: string, page?: number, pageSize?: number, options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(this.withPageSize(options, pageSize));
            const res = await this.getDownloadedFileApi()
                .apiDownloadJobsDownloadJobUuidfilesFormatGetCollection(downloadJobUuid, page, opts);
            return await res.json();
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    // ---------------------------------------------------------------------------
    // Downloaders
    // ---------------------------------------------------------------------------

    public async listDownloaders(page?: number, pageSize?: number, options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(this.withPageSize(options, pageSize));
            const res = await this.getDownloaderApi().apiDownloadersGetCollection(page, opts);
            return await res.json();
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    // ---------------------------------------------------------------------------
    // SupportedSites
    // ---------------------------------------------------------------------------

    public async listSupportedSites(page?: number, pageSize?: number, options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(this.withPageSize(options, pageSize));
            const res = await this.getSupportedSiteApi().apiSupportedSitesGetCollection(page, opts);
            return await res.json();
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    // ---------------------------------------------------------------------------
    // Sites
    // ---------------------------------------------------------------------------

    /** GET /sites (paginated; `search` matches name and domains) */
    public async listSites(params: { page?: number; itemsPerPage?: number; search?: string }): Promise<CollectionPage<Site>> {
        const query: Record<string, string> = {};
        if (params.page) query.page = String(params.page);
        if (params.itemsPerPage) query.itemsPerPage = String(params.itemsPerPage);
        if (params.search) query.search = params.search;
        const res = await this.requestJson<{ member?: Site[]; totalItems?: number }>('GET', '/sites', { query, accept: 'application/ld+json' });
        return { member: res.member ?? [], totalItems: res.totalItems ?? 0 };
    }

    /** GET /sites/{slug} (incl. extractors) */
    public async getSite(slug: string): Promise<SiteDetail> {
        return this.requestJson<SiteDetail>('GET', `/sites/${encodeURIComponent(slug)}`);
    }

    /** GET /users/settings/sites (only sites with overrides) */
    public async listUserSiteSettings(): Promise<UserSiteSettings[]> {
        return this.requestJson<UserSiteSettings[]>('GET', '/users/settings/sites', { query: { pagination: 'false' } });
    }

    /** GET /sites/resolve?url= */
    public async resolveSite(url: string): Promise<SiteResolution> {
        return this.requestJson<SiteResolution>('GET', '/sites/resolve', { query: { url } });
    }

    // ---------------------------------------------------------------------------
    // Client registry
    // ---------------------------------------------------------------------------

    /** POST /users/clients */
    public async registerClient(client: ClientCreate): Promise<Client> {
        return this.requestJson<Client>('POST', '/users/clients', { body: client });
    }

    /** GET /users/clients/{id} */
    public async getClient(id: string): Promise<Client> {
        return this.requestJson<Client>('GET', `/users/clients/${encodeURIComponent(id)}`);
    }

    /** GET /users/clients/{clientId}/settings */
    public async getClientSettings(clientId: string): Promise<ClientSettings> {
        return this.requestJson<ClientSettings>('GET', `/users/clients/${encodeURIComponent(clientId)}/settings`);
    }

    /** PUT /users/clients/{clientId}/settings (full replace, null = inherit) */
    public async putClientSettings(clientId: string, settings: ClientSettingsWrite): Promise<ClientSettings> {
        return this.requestJson<ClientSettings>('PUT', `/users/clients/${encodeURIComponent(clientId)}/settings`, { body: settings });
    }

    // ---------------------------------------------------------------------------
    // User settings layers
    // ---------------------------------------------------------------------------

    /** GET /users/settings */
    public async getUserSettings(): Promise<UserSettings> {
        return this.requestJson<UserSettings>('GET', '/users/settings');
    }

    /** PUT /users/settings */
    public async putUserSettings(settings: UserSettingsWrite): Promise<UserSettings> {
        return this.requestJson<UserSettings>('PUT', '/users/settings', { body: settings });
    }

    /** GET /users/settings/downloaders (includes downloaders without user settings) */
    public async listUserDownloaderSettings(): Promise<UserDownloaderSettings[]> {
        return this.requestJson<UserDownloaderSettings[]>('GET', '/users/settings/downloaders', { query: { pagination: 'false' } });
    }

    /** PUT /users/settings/downloaders/{downloader} */
    public async putUserDownloaderSettings(downloader: string, settings: UserDownloaderSettingsWrite): Promise<UserDownloaderSettings> {
        return this.requestJson<UserDownloaderSettings>('PUT', `/users/settings/downloaders/${encodeURIComponent(downloader)}`, { body: settings });
    }

    /**
     * GET /users/settings/sites/{slug}
     * Resolves to an empty override set when the user has no overrides for the site (404).
     */
    public async getUserSiteSettings(slug: string): Promise<UserSiteSettings> {
        try {
            return await this.requestJson<UserSiteSettings>('GET', `/users/settings/sites/${encodeURIComponent(slug)}`);
        } catch (err: any) {
            if (err?.status === 404) {
                return { slug };
            }
            throw err;
        }
    }

    /** PUT /users/settings/sites/{slug} */
    public async putUserSiteSettings(slug: string, settings: UserSiteSettingsWrite): Promise<UserSiteSettings> {
        return this.requestJson<UserSiteSettings>('PUT', `/users/settings/sites/${encodeURIComponent(slug)}`, { body: settings });
    }

    /** DELETE /users/settings/sites/{slug} (reset to inherit) */
    public async deleteUserSiteSettings(slug: string): Promise<void> {
        try {
            await this.requestJson<null>('DELETE', `/users/settings/sites/${encodeURIComponent(slug)}`);
        } catch (err: any) {
            if (err?.status !== 404) {
                throw err;
            }
        }
    }

    /** GET /downloaders/{id}/options-schema */
    public async getDownloaderOptionsSchema(downloader: string): Promise<DownloaderOptionsSchema> {
        return this.requestJson<DownloaderOptionsSchema>('GET', `/downloaders/${encodeURIComponent(downloader)}/options-schema`);
    }

    // ---------------------------------------------------------------------------
    // Client preferences
    // ---------------------------------------------------------------------------

    /** GET /users/client-preferences/{clientType} */
    public async getClientPreferences(clientType: string): Promise<ClientPreferences> {
        return this.requestJson<ClientPreferences>('GET', `/users/client-preferences/${encodeURIComponent(clientType)}`);
    }

    /** PUT /users/client-preferences/{clientType} */
    public async putClientPreferences(clientType: string, data: Record<string, unknown>): Promise<ClientPreferences> {
        return this.requestJson<ClientPreferences>('PUT', `/users/client-preferences/${encodeURIComponent(clientType)}`, { body: { data } });
    }

    // ---------------------------------------------------------------------------
    // Failure reports (ADR 0012)
    // ---------------------------------------------------------------------------

    /** POST /users/failure_reports; the body is sent exactly as the user confirmed it */
    public async submitFailureReport(body: FailureReportWrite): Promise<FailureReport> {
        return this.requestJson<FailureReport>('POST', '/users/failure_reports', { body });
    }

    /** GET /users/failure_reports (the user's own, newest first; JSON-LD for the total) */
    public async listFailureReports(params: { page?: number; itemsPerPage?: number }): Promise<CollectionPage<FailureReport>> {
        const query: Record<string, string> = {};
        if (params.page) query.page = String(params.page);
        if (params.itemsPerPage) query.itemsPerPage = String(params.itemsPerPage);
        const res = await this.requestJson<{ member?: FailureReport[]; totalItems?: number }>(
            'GET', '/users/failure_reports', { query, accept: 'application/ld+json' });
        return { member: res.member ?? [], totalItems: res.totalItems ?? 0 };
    }

    /** DELETE /users/failure_reports/{id} (withdraw; hard delete). Resolves when already gone (404). */
    public async withdrawFailureReport(id: string): Promise<void> {
        try {
            await this.requestJson<null>('DELETE', `/users/failure_reports/${encodeURIComponent(id)}`);
        } catch (err: any) {
            if (err?.status !== 404) {
                throw err;
            }
        }
    }

    /** GET /download_jobs/{uuid}/events, up to `itemsPerPage` events (JSON-LD collection) */
    public async listJobEvents(uuid: string, itemsPerPage = 100): Promise<DownloadJobEvent[]> {
        const res = await this.requestJson<{ member?: DownloadJobEvent[] }>(
            'GET', `/download_jobs/${encodeURIComponent(uuid)}/events`,
            { query: { itemsPerPage: String(itemsPerPage) }, accept: 'application/ld+json' });
        return res.member ?? [];
    }

    /** GET /versions (installed downloader versions) */
    public async listDownloaderVersions(): Promise<DownloaderVersion[]> {
        const res = await this.requestJson<{ member?: DownloaderVersion[] }>('GET', '/versions', { accept: 'application/ld+json' });
        return res.member ?? [];
    }

    // ---------------------------------------------------------------------------
    // Versions
    // ---------------------------------------------------------------------------

    public async getVersion(options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(options);
            const res = await this.getVersionApi().apiVersionsGetCollection(undefined, opts);
            return await res.json();
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    // ---------------------------------------------------------------------------
    // Server testing & OAuth2 discovery — use DownloadJobApi.testServer()
    // ---------------------------------------------------------------------------

    public async testHost(host: string) {
        await this.ready();
        const base = (host || '').replace(/\/+$/, '');
        const tempConf = new Configuration({ basePath: base });
        const tempApi = new DownloadJobApi(tempConf, undefined, this.getRuntimeFetch());
        return await tempApi.testServer().catch(async (err: any) => {
            throw await this.normalizeApiError(err);
        });
    }

    public async getOAuth2AuthorizationUrl(host: string): Promise<string> {
        await this.ready();
        const base = (host || '').replace(/\/+$/, '');
        const tempConf = new Configuration({ basePath: base });
        const tempApi = new DownloadJobApi(tempConf, undefined, this.getRuntimeFetch());
        const info = await tempApi.testServer().catch(async (err: any) => {
            throw await this.normalizeApiError(err);
        }) as any;

        if (info.authMode !== 'oauth2') {
            throw new Error(`Server auth mode is '${info.authMode}', not 'oauth2'`);
        }
        const authEndpoint: string | undefined = info.oauth2?.authorization_endpoint;
        if (!authEndpoint) {
            throw new Error('Server did not provide an oauth2.authorization_endpoint');
        }
        return resolveEndpoint(authEndpoint, base);
    }

    // ---------------------------------------------------------------------------
    // Error normalisation
    // ---------------------------------------------------------------------------

    /** Merges itemsPerPage into options.query so the generated client sends it as a query param */
    /**
     * POST /users/me/subscription-token: a short-lived Mercure subscriber token for the current user's own topics.
     *
     * Returns null when the server doesn't offer the endpoint (404, servers < 0.7), so callers can fall back to the
     * previous, anonymous per-job subscriptions.
     */
    public async getSubscriptionToken(): Promise<SubscriptionToken | null> {
        await this.ready();
        const cfg = await getMergedAppConfig();
        const base = (cfg.downloadRouterServerHost ?? '').replace(/\/+$/, '');
        if (!base) {
            throw new Error('No FetchDock server configured');
        }

        const opts = await this.buildAuthOptions({ method: 'POST', headers: { Accept: 'application/json' } });
        const res = await this.getRuntimeFetch()(`${base}/users/me/subscription-token`, opts);
        if (res.status === 404) {
            return null;
        }
        if (!res.ok) {
            throw await this.normalizeApiError(res);
        }

        return await res.json() as SubscriptionToken;
    }

    private withPageSize(options: any, pageSize?: number): any {
        if (!pageSize) return options;
        return this.mergeOptions(options ?? {}, { query: { itemsPerPage: pageSize } });
    }

    private async normalizeApiError(err: any) {
        if (err instanceof Response) {
            try {
                const text = await err.text();
                try { return { status: err.status, body: JSON.parse(text) }; }
                catch { return { status: err.status, body: text }; }
            } catch { return { status: err.status, body: null }; }
        }
        if (err && err.message) return err;
        return { status: 0, body: err };
    }
}

export const apiService = new ApiService();

