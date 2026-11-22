/**
 * Readable aliases for the generated OpenAPI schemas (`types.ts`, see `pnpm sync:api`).
 * The extension talks `application/json` to these endpoints, so the plain (non JSON-LD) variants are used.
 */
import type { components } from '@/api/types';

type Schemas = components['schemas'];

export type Site = Schemas['Site-site.read'];
export type SiteDetail = Schemas['Site-site.read_site.item'];
export type SiteResolution = Schemas['SiteResolution'];
export type RequestContext = NonNullable<SiteResolution['requestContext']>;
export type EffectiveSettings = NonNullable<SiteResolution['effectiveSettings']>;

export type Client = Schemas['Client-client.read'];
export type ClientCreate = Schemas['Client-client.write_client.create'];

export type ClientSettings = Schemas['ClientSettings-user_settings.read'];
export type ClientSettingsWrite = Schemas['ClientSettings-user_settings.write'];

export type UserSettings = Schemas['UserSettings-user_settings.read'];
export type UserSettingsWrite = Schemas['UserSettings-user_settings.write'];

export type UserDownloaderSettings = Schemas['UserDownloaderSettings-user_settings.read'];
export type UserDownloaderSettingsWrite = Schemas['UserDownloaderSettings-user_settings.write'];

export type UserSiteSettings = Schemas['UserSiteSettings-user_settings.read'];
export type UserSiteSettingsWrite = Schemas['UserSiteSettings-user_settings.write'];

export type DownloaderOptionsSchema = Schemas['DownloaderOptionsSchema-downloader_options_schema.read'];
/** Free-form option values keyed by option key (see DownloaderOptionsSchema.properties) */
export type DownloaderOptions = Record<string, unknown>;

export type ClientPreferences = Schemas['ClientPreferences-client_preferences.read'];

export type Downloader = Schemas['Downloader'];

export type DownloadJobDTO = Schemas['DownloadJob.DownloadJobDTO'];

/** A page of a collection, read from the JSON-LD representation (which carries the total). */
export interface CollectionPage<T> {
    member: T[];
    totalItems: number;
}

/** Client type this extension registers as (Client.type / client-preferences path) */
export const CLIENT_TYPE = 'browser-extension';

export type FailureReport = Schemas['FailureReport-failure_report.read'];
export type FailureReportWrite = Schemas['FailureReport-failure_report.write'];
export type FailureReportKind = FailureReportWrite['kind'];
export type FailureReportDiagnostics = Schemas['FailureReportDiagnostics-failure_report.write'];

export type DownloadJobEvent = Schemas['DownloadJobEvent'];
export type DownloaderVersion = Schemas['DownloaderVersion'];
