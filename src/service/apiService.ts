import {
    Configuration,
    DownloaderApi,
    DownloadJobApi,
    DownloadJobDownloadJobDTO,
    SupportedSiteApi,
    VersionApi
} from "@/service/api";
import {getMergedAppConfig, subscribeToAppConfigChanges} from "@/lib/config";
import type {WxtAppConfig} from "@/lib/types";
import {tokenManager} from "@/lib/tokenManager";

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
    private versionApi?: VersionApi;
    private supportedSiteApi?: SupportedSiteApi;
    private downloaderApi?: DownloaderApi;

    // Default request options that will be merged into every API call.
    private defaultRequestOptions: any = {};

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
        void this.listSupportedSites;
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
            const res = await fetch(`${base}/.well-known/browser-extension`);
            if (!res.ok) return;
            const data = await res.json();
            const endpoint: string | undefined = data?.oauth2?.token_endpoint;
            if (endpoint) {
                this.tokenEndpoint = endpoint.startsWith('http')
                    ? endpoint
                    : base + (endpoint.startsWith('/') ? '' : '/') + endpoint;
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
        this.versionApi = undefined;
        this.supportedSiteApi = undefined;
        this.downloaderApi = undefined;
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
            // Pass the runtime fetch implementation to avoid relying on the generated file's isomorphic-fetch import
            this.downloadJobApi = new DownloadJobApi(this.configuration, undefined, this.getRuntimeFetch());
        }
        return this.downloadJobApi;
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

    public async submitDownloadJob(job: DownloadJobDownloadJobDTO, options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(options);
            return await this.getDownloadJobApi().apiDownloadJobsPost(job, opts);
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    public async listDownloaders(page?: number, options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(options);
            return await this.getDownloaderApi().apiDownloadersGetCollection(page, opts);
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    public async listSupportedSites(page?: number, options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(options);
            return await this.getSupportedSiteApi().apiSupportedSitesGetCollection(page, opts);
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    public async getVersion(options?: any) {
        await this.ready();
        try {
            const opts = await this.buildAuthOptions(options);
            return await this.getVersionApi().apiVersionsGetCollection(undefined, opts);
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    public async testHost(host: string) {
        await this.ready();
        // Test the provided host by instantiating a transient API client using that base path.
        const base = (host || '').replace(/\/\/+$/, '');
        const tempConf = new Configuration({ basePath: base });
        const tempDownloaderApi = new DownloaderApi(tempConf, undefined, this.getRuntimeFetch());

        return await tempDownloaderApi.testServer().catch(async (err: any) => {
            throw await this.normalizeApiError(err);
        });
    }

    /**
     * Returns the OAuth2 authorization endpoint URL for the given host by reading the well-known endpoint.
     */
    public async getOAuth2AuthorizationUrl(host: string): Promise<string> {
        await this.ready();
        const base = (host || '').replace(/\/+$/, '');
        const tempConf = new Configuration({ basePath: base });
        const tempDownloaderApi = new DownloaderApi(tempConf, undefined, this.getRuntimeFetch());
        const info = await tempDownloaderApi.testServer().catch(async (err: any) => {
            throw await this.normalizeApiError(err);
        }) as any;

        if (info.authMode !== 'oauth2') {
            throw new Error(`Server auth mode is '${info.authMode}', not 'oauth2'`);
        }

        const authEndpoint: string | undefined = info.oauth2?.authorization_endpoint;
        if (!authEndpoint) {
            throw new Error('Server did not provide an oauth2.authorization_endpoint');
        }

        // The endpoint may be a relative path – resolve it against the server base.
        if (authEndpoint.startsWith('http://') || authEndpoint.startsWith('https://')) {
            return authEndpoint;
        }
        return base + (authEndpoint.startsWith('/') ? '' : '/') + authEndpoint;
    }

    // Try to extract a useful error shape from the thrown value
    private async normalizeApiError(err: any) {
        // The generated client throws the raw Response for non-2xx. Try to parse it.
        if (err instanceof Response) {
            try {
                const text = await err.text();
                try {
                    const json = JSON.parse(text);
                    return { status: err.status, body: json };
                } catch {
                    return { status: err.status, body: text };
                }
            } catch (e) {
                return { status: err.status, body: null };
            }
        }

        // If it's an Error already, rethrow
        if (err && err.message) {
            return err;
        }

        return { status: 0, body: err };
    }
}

export const apiService = new ApiService();

export type { DownloadJobDownloadJobDTO };
