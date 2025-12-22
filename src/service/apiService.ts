import { Configuration, DownloadJobApi, DownloaderApi, DownloadJobDownloadJobDTO, VersionApi, SupportedSiteApi } from "@/service/api";
import { getMergedAppConfig, subscribeToAppConfigChanges } from "@/lib/config";
import type { WxtAppConfig } from "@/lib/types";

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
    // Useful for default headers like Content-Type, auth, etc.
    private defaultRequestOptions: any = {};

    private initPromise?: Promise<void> | null = null;

    constructor() {
        // Start initialization asynchronously
        this.initPromise = this.init();

        // Subscribe to runtime config changes and update Configuration accordingly
        subscribeToAppConfigChanges((newConfig) => {
            this.updateConfigurationFromAppConfig(newConfig);
        });

        // Reference public API methods and setters so static analyzers/tooling recognize they are intentionally exported/used.
        this._markPublicApiForTools();
    }

    // This method exists to create references to public methods so static analysis doesn't report them as unused.
    // It intentionally does nothing at runtime.
    private _markPublicApiForTools(): void {
        void this.setDefaultRequestOptions;
        void this.setDefaultRequestHeaders;
        void this.submitDownloadJob;
        void this.listSupportedSites;
        void this.getVersion;
        void this.listDownloaders;
        void this.testHost;
    }

    private async init() {
        const cfg = await getMergedAppConfig();
        this.updateConfigurationFromAppConfig(cfg);
    }

    private updateConfigurationFromAppConfig(cfg: WxtAppConfig) {
        const conf: any = {};
        if (cfg.apiKey) {
            conf.apiKey = cfg.apiKey;
        }
        if (cfg.downloadRouterServerHost) {
            conf.basePath = cfg.downloadRouterServerHost.replace(/\/+$/, '');
        }

        this.configuration = new Configuration(conf);

        // drop cached API instances so they'll be recreated using new configuration
        this.downloadJobApi = undefined;
        this.versionApi = undefined;
        this.supportedSiteApi = undefined;
        this.downloaderApi = undefined;
    }

    // Ensure initialization has completed
    private async ready() {
        if (this.initPromise) {
            await this.initPromise;
            this.initPromise = null;
        }
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

    /**
     * Submits a download job to the server
     */
    public async submitDownloadJob(job: DownloadJobDownloadJobDTO, options?: any) {
        await this.ready();
        try {
            const opts = this.buildRequestOptions(options);
            return await this.getDownloadJobApi().apiDownloadJobsPost(job, opts);
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    public async listDownloaders(page?: number, options?: any) {
        await this.ready();
        try {
            const opts = this.buildRequestOptions(options);
            return await this.getDownloaderApi().apiDownloadersGetCollection(page, opts);
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    /**
     * List supported sites
     */
    public async listSupportedSites(page?: number, options?: any) {
        await this.ready();
        try {
            const opts = this.buildRequestOptions(options);
            return await this.getSupportedSiteApi().apiSupportedSitesGetCollection(page, opts);
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    /**
     * Get version info
     */
    public async getVersion(options?: any) {
        await this.ready();
        try {
            const opts = this.buildRequestOptions(options);
            // apiVersionsGetCollection accepts (page?, options?)
            return await this.getVersionApi().apiVersionsGetCollection(undefined, opts);
        } catch (err: any) {
            throw await this.normalizeApiError(err);
        }
    }

    public async testHost(host: string) {
        await this.ready();
        // Test the provided host by instantiating a transient API client using that base path.
        const base = (host || '').replace(/\/\/+$/, '');
        const tempConfig: any = { basePath: base };
        const tempConf = new Configuration(tempConfig);
        const tempDownloaderApi = new DownloaderApi(tempConf, undefined, this.getRuntimeFetch());

        // First attempt to fetch available downloaders and normalize API errors.
        const opts = this.buildRequestOptions();
        const availableDownloaders = await tempDownloaderApi.apiDownloadersGetCollection(undefined, opts).catch(async (err: any) => { throw await this.normalizeApiError(err); });

        console.debug(availableDownloaders);

        if ((availableDownloaders.member?.length ?? 0) === 0) {
            // Normalize and throw an error for the empty-downloaders case.
            throw await this.normalizeApiError(new Error('No downloaders are available on the server'));
        }
        return;
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
