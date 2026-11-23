import { onMessage } from '@/lib/messaging';
import { getMergedAppConfig } from '@/lib/config';
import { fetchDiscovery } from '@/lib/fetchUtils';
import { NO_SERVER_FEATURES, parseServerFeatures, type ServerFeatures } from '@/lib/wellKnown';
import { isHttpUrl, type FailureReportContext } from '@/lib/failureReport';
import { apiService } from '@/service/apiService';
import { call } from '@/service/apiErrors';
import type { DownloadJobEvent } from '@/api/schemas';

/** DownloadJob.state of a failed job */
const JOB_STATE_FAILED = 3;
const FEATURES_TTL_MS = 5 * 60 * 1000;
export const REPORT_PAGE_MENU_ID = 'reportPageProblem';

let featuresCache: { server: string; fetchedAt: number; features: ServerFeatures } | null = null;

async function currentServer(): Promise<string> {
    return ((await getMergedAppConfig()).downloadRouterServerHost ?? '').replace(/\/+$/, '');
}

/** The server's optional features from its well-known document (cached briefly); none when unreachable. */
export async function getServerFeatures(force = false): Promise<ServerFeatures> {
    const server = await currentServer();
    if (!server) {
        return NO_SERVER_FEATURES;
    }
    if (!force && featuresCache?.server === server && Date.now() - featuresCache.fetchedAt < FEATURES_TTL_MS) {
        return featuresCache.features;
    }

    try {
        const res = await fetchDiscovery(`${server}/.well-known/browser-extension`);
        if (res.ok) {
            const features = parseServerFeatures(await res.json(), server);
            featuresCache = { server, fetchedAt: Date.now(), features };
            return features;
        }
    } catch (err) {
        console.warn('[failureReports] Reading the well-known document failed', err);
    }
    // Not cached: an unreachable server (offline, certificate not yet accepted) must not hide reporting for minutes
    return NO_SERVER_FEATURES;
}

function lastSegment(value: string): string {
    return value.split('/').filter(Boolean).at(-1) ?? value;
}

/** The newest error message of a job: an exception, otherwise the message of a failure event. */
export function lastJobError(events: DownloadJobEvent[]): string | null {
    const newestFirst = [...events].sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''));
    const exception = newestFirst.find((e) => e.exceptionMessage?.trim());
    if (exception) {
        return exception.exceptionMessage!.trim();
    }
    const failure = newestFirst.find((e) => /fail|error/i.test(e.event ?? '') && e.updateMessage?.trim());
    return failure?.updateMessage?.trim() ?? null;
}

async function jobContext(uuid: string): Promise<FailureReportContext> {
    const job: any = await apiService.getDownloadJob(uuid);
    if (job?.state !== JOB_STATE_FAILED) {
        throw new Error('Only failed download jobs can be reported.');
    }
    if (!isHttpUrl(job.uri)) {
        throw new Error('This job has no http(s) URL to report.');
    }

    const downloader = typeof job.downloader === 'string' && job.downloader ? lastSegment(job.downloader) : null;
    const [events, versions] = await Promise.all([
        apiService.listJobEvents(uuid).catch(() => []),
        downloader ? apiService.listDownloaderVersions().catch(() => []) : Promise.resolve([]),
    ]);
    const version = versions.find((v) => v.id === downloader);

    return {
        kind: 'job_failed',
        url: job.uri,
        downloadJob: typeof job['@id'] === 'string' ? job['@id'] : `/download_jobs/${uuid}`,
        userAgent: navigator.userAgent,
        // The page the job came from isn't known here, and the server's copy is never reused (ADR 0012)
        referrer: null,
        diagnostics: {
            downloader,
            downloaderVersion: version?.currentVersion || version?.version || null,
            errorMessage: lastJobError(events),
            clientVersion: `FetchDock extension ${browser.runtime.getManifest().version}`,
        },
    };
}

async function urlContext(url: string, referrer?: string | null): Promise<FailureReportContext> {
    if (!isHttpUrl(url)) {
        throw new Error('Only http(s) pages can be reported.');
    }
    return {
        kind: 'unsupported_url',
        url,
        downloadJob: null,
        userAgent: navigator.userAgent,
        referrer: isHttpUrl(referrer) ? referrer : null,
        diagnostics: {},
    };
}

/** Reads the page's `document.referrer`; null when the tab can't be scripted (store pages, other extensions). */
async function tabReferrer(tabId: number): Promise<string | null> {
    try {
        const [result] = await browser.scripting.executeScript({ target: { tabId }, func: () => document.referrer });
        return typeof result?.result === 'string' && result.result ? result.result : null;
    } catch (err) {
        console.warn('[failureReports] Reading the page referrer failed', tabId, String(err));
        return null;
    }
}

/** Opens the report form in a popup window (a tab where windows aren't available). */
export async function openReportForm(data: { jobUuid?: string; url?: string; tabId?: number }): Promise<void> {
    const params = new URLSearchParams();
    if (data.jobUuid) {
        params.set('job', data.jobUuid);
    } else if (data.url) {
        params.set('url', data.url);
        const referrer = data.tabId != null ? await tabReferrer(data.tabId) : null;
        if (referrer) params.set('referrer', referrer);
    } else {
        throw new Error('Nothing to report');
    }

    const url = browser.runtime.getURL(`/report.html?${params}` as any);
    if (browser.windows?.create) {
        await browser.windows.create({ url, type: 'popup', width: 680, height: 820 });
    } else {
        await browser.tabs.create({ url });
    }
}

/** Shows the page context menu entry only when the server accepts reports. */
export async function updateReportMenu(): Promise<void> {
    if (!browser.contextMenus) return;
    const { failureReports } = await getServerFeatures();
    try {
        await browser.contextMenus.update(REPORT_PAGE_MENU_ID, { visible: failureReports });
    } catch (err) {
        console.warn('[failureReports] Updating the context menu failed', err);
    }
}

export function registerFailureReportHandlers(): void {
    onMessage('getServerFeatures', ({ data }) => getServerFeatures(!!data?.force));

    onMessage('openReportForm', ({ data }) => call(() => openReportForm(data)));

    onMessage('getFailureReportContext', ({ data }) => call(() =>
        data.jobUuid ? jobContext(data.jobUuid) : urlContext(data.url ?? '', data.referrer)));

    onMessage('submitFailureReport', ({ data }) => call(() => apiService.submitFailureReport(data)));
    onMessage('listFailureReports', ({ data }) => call(() => apiService.listFailureReports(data)));
    onMessage('withdrawFailureReport', ({ data }) => call(() => apiService.withdrawFailureReport(data)));
}
