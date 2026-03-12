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
import type {WxtAppConfig, DownloadJobDTO} from "@/lib/types";
import {tokenManager} from "@/lib/tokenManager";
import { fetchDiscovery, resolveEndpoint } from "@/lib/fetchUtils";

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
     * Fetches the well-known document and caches oauth2.token_endpoint if present.
     */
    private async discoverTokenEndpoint(cfg: WxtAppConfig): Promise<void> {
        const base = (cfg.downloadRouterServerHost ?? '').replace(/\/+$/, '');
        if (!base) return;
        try {
            const res = await fetchDiscovery(`${base}/.well-known/browser-extension`);
            if (!res.ok) return;
            const data = await res.json();
            const endpoint: string | undefined = data?.oauth2?.token_endpoint;
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
        const authHeaders = accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {};
        return this.mergeOptions(this.buildRequestOptions(options), { headers: authHeaders });
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

