import { sendMessage } from '@/lib/messaging';
import type { DownloadJobFinished, DownloadJobProgressEvent, SubscriptionToken } from '@/lib/types';
import type { SendMessageOptions } from '@webext-core/messaging';
import { apiService } from '@/service/apiService';
import { getMergedAppConfig } from '@/lib/config';

/**
 * MercureService — live updates for download jobs via Mercure (Server-Sent Events).
 *
 * ## Servers >= 0.7 (private updates)
 *
 *  The server publishes all of a user's updates privately under "/users/{user uuid}/…". The hub doesn't accept
 *  anonymous subscribers, so the service:
 *
 *   1. requests a short-lived subscriber token: `POST /users/me/subscription-token` → `{hubUrl, token, topics, expiresAt}`
 *   2. opens **one** EventSource for all tracked jobs: `{hubUrl}?topic={topics…}&authorization={token}`
 *      (a plain EventSource can't set headers, and third-party cookies aren't reliable for an extension origin)
 *   3. receives structured progress events (`{job, type: "state" | "progress" | "error", …}`) and notifies the
 *      originating tab when a tracked job completes or fails
 *   4. renews the token before it expires and reconnects; on a connection error it requests a new token, with backoff
 *
 *  The stream is only open while jobs are being tracked. The token is kept in memory only.
 *
 * ## Older servers (fallback)
 *
 *  If the token endpoint doesn't exist (404), the service falls back to the previous anonymous per-job
 *  subscriptions on `/download_jobs/{token}`.
 *
 * ## MV3 service-worker persistence
 *
 *  Tracked jobs are kept in `browser.storage.session`. After a service-worker restart, they are restored and the
 *  stream is reopened with a fresh token.
 *
 *  Note: `EventSource` in service workers requires Chrome ≥ 112 / Firefox ≥ 115.
 */

/** Numeric terminal states of servers < 0.7 (fallback subscriptions): completed, failed, cancelled */
const LEGACY_TERMINAL_STATES: Array<number | string> = [2, 3, 4];

/** Renew the subscriber token this long before it expires */
const TOKEN_RENEW_MARGIN_MS = 60_000;
/** Reconnect backoff after connection errors: 2 s, 4 s, … up to 60 s */
const RECONNECT_BASE_DELAY_MS = 2_000;
const RECONNECT_MAX_DELAY_MS = 60_000;

const SESSION_KEY_JOBS = 'mercureTrackedJobs';

interface TrackedJob {
    /** Job UUID (servers >= 0.7 identify jobs in progress events by UUID) */
    uuid?: string;
    /** Job token (used by the fallback subscription topic) */
    token: string;
    tabId: number;
    uri?: string;
    /** Last error message reported for the job */
    lastError?: string;
}

type Mode = 'unknown' | 'user-stream' | 'legacy';

class MercureService {
    /** Tracked jobs, keyed by job token */
    private trackedJobs: Map<string, TrackedJob> = new Map();

    private mode: Mode = 'unknown';

    // Servers >= 0.7: one stream for all of the user's updates
    private userStream: EventSource | null = null;
    private connecting: Promise<void> | null = null;
    private renewTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;

    // Fallback: one anonymous stream per job, keyed by job token
    /** Hub URL for the fallback, known from a token response or derived from the configured server */
    private legacyHubUrl: string | null = null;
    private legacyStreams: Map<string, EventSource> = new Map();

    constructor() {
        this.restore().catch((err) => console.warn('[MercureService] Restore failed:', err));
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Register a newly accepted download job for live updates.
     *
     * @param job    - The creation response (`jobUuid` and `token`).
     * @param tabId  - Browser tab that triggered the download (targeted messaging).
     * @param uri    - Original URI submitted (shown in the notification).
     */
    public trackJob(job: { jobUuid?: string; token: string }, tabId: number, uri?: string): void {
        this.trackedJobs.set(job.token, { uuid: job.jobUuid, token: job.token, tabId, uri });
        void this.persist();
        console.debug('[MercureService] Tracking job:', job.jobUuid ?? job.token, 'for tab:', tabId);

        void this.ensureSubscribed(job.token);
    }

    /** Stop tracking a job; closes the connection when no jobs are left. */
    public untrackJob(token: string): void {
        this.trackedJobs.delete(token);
        this.legacyStreams.get(token)?.close();
        this.legacyStreams.delete(token);
        void this.persist();

        if (this.trackedJobs.size === 0) {
            this.closeUserStream();
        }
    }

    /** Stop tracking a job by its uuid (e.g. after it was deleted). */
    public untrackJobByUuid(uuid: string): void {
        for (const tracked of [...this.trackedJobs.values()]) {
            if (tracked.uuid === uuid) {
                this.untrackJob(tracked.token);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Subscribing
    // -------------------------------------------------------------------------

    private async ensureSubscribed(token: string): Promise<void> {
        if (this.mode !== 'legacy') {
            await this.ensureUserStream();
        }
        // In legacy mode, openUserStream() already subscribed the jobs tracked at that time
        if (this.mode === 'legacy' && !this.legacyStreams.has(token)) {
            await this.subscribeLegacy(token);
        }
    }

    /** Opens the user stream if it isn't open (or being opened) yet. */
    private ensureUserStream(): Promise<void> {
        if (this.userStream || this.trackedJobs.size === 0) {
            return Promise.resolve();
        }
        this.connecting ??= this.openUserStream().finally(() => {
            this.connecting = null;
        });

        return this.connecting;
    }

    private async openUserStream(): Promise<void> {
        let subscription: SubscriptionToken | null;
        try {
            subscription = await apiService.getSubscriptionToken();
        } catch (err) {
            console.warn('[MercureService] Could not get a subscription token:', err);
            this.scheduleReconnect();
            return;
        }

        if (subscription === null) {
            console.info('[MercureService] Server has no subscription token endpoint, falling back to per-job subscriptions');
            this.mode = 'legacy';
            for (const token of this.trackedJobs.keys()) {
                await this.subscribeLegacy(token);
            }
            return;
        }

        this.mode = 'user-stream';
        this.closeUserStream();

        const url = new URL(subscription.hubUrl);
        for (const topic of subscription.topics) {
            url.searchParams.append('topic', topic);
        }
        url.searchParams.set('authorization', subscription.token);
        // Also needed by the fallback if the server is ever downgraded
        this.legacyHubUrl = subscription.hubUrl;

        const es = new EventSource(url.toString());
        es.onopen = () => {
            this.reconnectAttempts = 0;
        };
        es.onmessage = (event: MessageEvent) => {
            try {
                this.handleUserStreamEvent(JSON.parse(event.data as string));
            } catch (err) {
                console.error('[MercureService] Failed to parse event data:', err);
            }
        };
        es.onerror = () => {
            // Expired or invalid tokens and network errors: reconnect with a fresh token, with backoff
            if (this.userStream === es) {
                console.warn('[MercureService] Connection error, reconnecting with a fresh token');
                this.closeUserStream();
                this.scheduleReconnect();
            }
        };
        this.userStream = es;

        // Renew the token shortly before it expires
        const renewIn = new Date(subscription.expiresAt).getTime() - Date.now() - TOKEN_RENEW_MARGIN_MS;
        this.renewTimer = setTimeout(() => {
            this.closeUserStream();
            void this.ensureUserStream();
        }, Math.max(renewIn, 0));
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer || this.trackedJobs.size === 0) {
            return;
        }
        const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY_MS);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            void this.ensureUserStream();
        }, delay);
    }

    private closeUserStream(): void {
        this.userStream?.close();
        this.userStream = null;
        if (this.renewTimer) {
            clearTimeout(this.renewTimer);
            this.renewTimer = null;
        }
        if (this.trackedJobs.size === 0 && this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * Handles an event of the user stream. Besides progress events, the stream also carries other updates of the user
     * (e.g. job resources); only progress events of tracked jobs are used here.
     */
    private handleUserStreamEvent(data: unknown): void {
        const event = data as Partial<DownloadJobProgressEvent>;
        if (typeof event?.job !== 'string' || typeof event.type !== 'string') {
            return;
        }
        const tracked = Array.from(this.trackedJobs.values()).find((job) => job.uuid === event.job);
        if (!tracked) {
            return;
        }

        if (event.type === 'error') {
            tracked.lastError = (event as { message: string }).message;
            void this.persist();
            return;
        }
        if (event.type === 'state') {
            const state = (event as { state: string }).state;
            if (state === 'completed' || state === 'failed') {
                this.notifyFinished(tracked, state);
            }
        }
    }

    private notifyFinished(tracked: TrackedJob, state: number | string): void {
        const payload: DownloadJobFinished = {
            jobToken: tracked.token,
            jobUuid: tracked.uuid,
            state,
            uri: tracked.uri,
            error: state === 'failed' ? tracked.lastError : undefined,
        };
        const opts: SendMessageOptions = { tabId: tracked.tabId };
        sendMessage('downloadJobFinished', payload, opts);

        this.untrackJob(tracked.token);
        console.debug('[MercureService] Job finished:', tracked.uuid ?? tracked.token, '— state:', state);
    }

    // -------------------------------------------------------------------------
    // Fallback for servers < 0.7: anonymous per-job subscriptions
    // -------------------------------------------------------------------------

    private async subscribeLegacy(token: string): Promise<void> {
        const hubUrl = this.legacyHubUrl ?? await this.legacyHubUrlFromConfig();
        if (!hubUrl) {
            console.warn('[MercureService] Cannot subscribe — hub URL not known');
            return;
        }
        this.legacyStreams.get(token)?.close();

        const url = new URL(hubUrl);
        url.searchParams.set('topic', `/download_jobs/${token}`);
        const es = new EventSource(url.toString(), { withCredentials: true });
        es.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data as string);
                const tracked = this.trackedJobs.get(token);
                if (tracked && LEGACY_TERMINAL_STATES.includes(data?.state)) {
                    this.notifyFinished(tracked, data.state);
                }
            } catch (err) {
                console.error('[MercureService] Failed to parse event data:', err);
            }
        };
        this.legacyStreams.set(token, es);
    }

    private async legacyHubUrlFromConfig(): Promise<string | null> {
        const host = ((await getMergedAppConfig()).downloadRouterServerHost ?? '').replace(/\/+$/, '');

        return host ? `${host}/.well-known/mercure` : null;
    }

    // -------------------------------------------------------------------------
    // Session-storage persistence (survives MV3 SW restarts)
    // -------------------------------------------------------------------------

    private async restore(): Promise<void> {
        const data = await browser.storage.session.get(SESSION_KEY_JOBS);
        const savedJobs = data[SESSION_KEY_JOBS] as TrackedJob[] | undefined;
        if (!savedJobs?.length) {
            return;
        }
        for (const job of savedJobs) {
            this.trackedJobs.set(job.token, job);
        }
        console.debug('[MercureService] Restored', savedJobs.length, 'tracked job(s)');

        // Opens the user stream, or subscribes per job if the server has no token endpoint
        await this.ensureUserStream();
    }

    private async persist(): Promise<void> {
        await browser.storage.session.set({ [SESSION_KEY_JOBS]: Array.from(this.trackedJobs.values()) });
    }
}

export const mercureService = new MercureService();
