import { sendMessage } from '@/lib/messaging';
import type { DownloadJobFinished } from '@/lib/types';
import type { SendMessageOptions } from '@webext-core/messaging';

/**
 * MercureService — manages Mercure SSE subscriptions for download job tracking.
 *
 * ## Mercure Protocol
 *
 * Mercure (https://mercure.rocks) layers real-time push updates on top of
 * Server-Sent Events (SSE):
 *
 *  1. The API server returns a `Link` response header on resource endpoints:
 *
 *       Link: <https://example.com/.well-known/mercure>; rel="mercure"
 *
 *  2. The client opens an EventSource connection to that hub URL with a `topic`
 *     query param matching the resource IRI:
 *
 *       GET https://example.com/.well-known/mercure?topic=/download_jobs/{token}
 *
 *  3. The hub forwards server-published updates to all subscribed clients.
 *
 * ## Extension Integration
 *
 *  - `background.ts` calls `mercureService.trackJob()` right after a job is
 *    accepted. It supplies the job token, originating tab ID, optional URI, and
 *    the Mercure hub URL extracted from the `POST /download_jobs` `Link` header.
 *
 *  - When a terminal state event arrives, the service sends `downloadJobFinished`
 *    targeted at the originating tab; the content script's toast manager shows it.
 *
 * ## MV3 Service-Worker Persistence
 *
 *  Chrome MV3 background service workers can be terminated when idle. To survive
 *  restarts, tracked jobs and the hub URL are persisted in `browser.storage.session`
 *  (in-memory, survives SW restarts within a browser session). On construction the
 *  service restores any in-progress jobs and re-opens their EventSource connections.
 *
 *  Note: `EventSource` in service workers requires Chrome ≥ 112 / Firefox ≥ 115.
 */

/** Terminal state values used by the FetchDock server */
const TERMINAL_STATES: Array<number | string> = [3, 4, 5]; // completed, failed, cancelled

const SESSION_KEY_JOBS   = 'mercureTrackedJobs';
const SESSION_KEY_HUB    = 'mercureHubUrl';

interface TrackedJob {
    token: string;
    tabId: number;
    uri?: string;
}

class MercureService {
    /** Maps job token → tracked job metadata */
    private trackedJobs: Map<string, TrackedJob> = new Map();

    /**
     * Mercure hub URL. Typically discovered from:
     *  - The `Link` header of a successful `POST /download_jobs` response, OR
     *  - The server's `/.well-known/browser-extension` document.
     */
    private hubUrl: string | null = null;

    /** Active EventSource connections, keyed by job token */
    private eventSources: Map<string, EventSource> = new Map();

    constructor() {
        // Restore any in-progress jobs that were active before the SW was terminated.
        this.restore().catch((err) =>
            console.warn('[MercureService] Restore failed:', err)
        );
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Set (or update) the Mercure hub URL.
     * Persists the URL and (re-)subscribes all currently tracked jobs.
     */
    public setHubUrl(hubUrl: string): void {
        if (this.hubUrl === hubUrl) return;
        this.hubUrl = hubUrl;
        console.debug('[MercureService] Hub URL set:', hubUrl);

        void this.persist();

        // Re-subscribe all tracked jobs now that we have a hub URL.
        for (const token of this.trackedJobs.keys()) {
            this.subscribeToJob(token);
        }
    }

    /**
     * Register a newly accepted download job for Mercure tracking.
     *
     * @param token   - Unique token returned by the server for the job.
     * @param tabId   - Browser tab that triggered the download (targeted messaging).
     * @param uri     - Original URI submitted (shown in the toast notification).
     * @param hubUrl  - Mercure hub URL, if already known from the `Link` response header.
     */
    public trackJob(token: string, tabId: number, uri?: string, hubUrl?: string): void {
        if (hubUrl) this.setHubUrl(hubUrl);

        this.trackedJobs.set(token, { token, tabId, uri });
        void this.persist();
        console.debug('[MercureService] Tracking job:', token, 'for tab:', tabId);

        if (this.hubUrl) {
            this.subscribeToJob(token);
        } else {
            console.warn('[MercureService] Hub URL not yet known — will subscribe once setHubUrl() is called');
        }
    }

    /**
     * Stop tracking a job and close its EventSource connection.
     */
    public untrackJob(token: string): void {
        this.trackedJobs.delete(token);
        this.eventSources.get(token)?.close();
        this.eventSources.delete(token);
        void this.persist();
        console.debug('[MercureService] Stopped tracking job:', token);
    }

    // -------------------------------------------------------------------------
    // Session-storage persistence (survives MV3 SW restarts)
    // -------------------------------------------------------------------------

    private async restore(): Promise<void> {
        const data = await browser.storage.session.get([SESSION_KEY_JOBS, SESSION_KEY_HUB]);

        const savedHubUrl = data[SESSION_KEY_HUB] as string | undefined;
        if (savedHubUrl) {
            this.hubUrl = savedHubUrl;
            console.debug('[MercureService] Restored hub URL:', this.hubUrl);
        }

        const savedJobs = data[SESSION_KEY_JOBS] as TrackedJob[] | undefined;
        if (savedJobs?.length) {
            for (const job of savedJobs) {
                this.trackedJobs.set(job.token, job);
                if (this.hubUrl) {
                    this.subscribeToJob(job.token);
                }
            }
            console.debug('[MercureService] Restored', savedJobs.length, 'tracked job(s)');
        }
    }

    private async persist(): Promise<void> {
        await browser.storage.session.set({
            [SESSION_KEY_JOBS]: Array.from(this.trackedJobs.values()),
            [SESSION_KEY_HUB]:  this.hubUrl,
        });
    }

    // -------------------------------------------------------------------------
    // EventSource subscription
    // -------------------------------------------------------------------------

    /**
     * Open (or reopen) an EventSource subscription to the Mercure hub for one job.
     *
     * Topic convention: `/download_jobs/{token}`
     *
     * Authentication: `withCredentials: true` forwards session cookies. If the hub
     * requires a separate JWT, append it as `?authorization={jwt}` — this can be
     * added once the server exposes a short-lived Mercure JWT endpoint.
     */
    private subscribeToJob(token: string): void {
        if (!this.hubUrl) {
            console.warn('[MercureService] Cannot subscribe — hub URL not yet known');
            return;
        }

        // Close any stale connection before (re-)subscribing.
        this.eventSources.get(token)?.close();

        const topic = encodeURIComponent(`/download_jobs/${token}`);
        const url = `${this.hubUrl}?topic=${topic}`;
        console.debug('[MercureService] Subscribing to:', url);

        const es = new EventSource(url, { withCredentials: true });

        es.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data as string);
                this.handleJobUpdate(token, data);
            } catch (err) {
                console.error('[MercureService] Failed to parse event data:', err, event.data);

                es.close();
                this.eventSources.delete(token);
            }
        };

        // es.onerror = (err) => {
        //     console.error('[MercureService] EventSource error for job', token, err);
        //     // Close and remove — the next SW wake-up will re-subscribe via restore().
        //     es.close();
        //     this.eventSources.delete(token);
        // };

        this.eventSources.set(token, es);
    }

    /**
     * Process an incoming Mercure event for a tracked job.
     *
     * Sends `downloadJobFinished` to the originating tab when the job enters a
     * terminal state; ignores non-terminal state changes.
     *
     * Terminal states (FetchDock server):
     *   3 = completed
     *   4 = failed
     *   5 = cancelled
     */
    private handleJobUpdate(token: string, data: any): void {
        const tracked = this.trackedJobs.get(token);
        if (!tracked) return;

        if (!TERMINAL_STATES.includes(data.state)) {
            console.debug('[MercureService] Non-terminal update for', token, '— state:', data.state);
            return;
        }

        const payload: DownloadJobFinished = {
            jobToken: token,
            state:    data.state,
            uri:      tracked.uri,
        };

        const opts: SendMessageOptions = { tabId: tracked.tabId };
        sendMessage('downloadJobFinished', payload, opts);

        this.untrackJob(token);
        console.debug('[MercureService] Job reached terminal state:', token, '— state:', data.state);
    }
}

export const mercureService = new MercureService();

