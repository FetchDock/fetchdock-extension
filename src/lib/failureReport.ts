/**
 * Composes failure report bodies (POST /users/failure_reports, ADR 0012).
 *
 * The form shows the exact body this module returns, and that body is sent unchanged. Nothing may be added
 * after the user confirms, so every field here is either required (`kind`, `url`, `downloadJob`) or opted into.
 * Cookies and other request data are never part of a report.
 */
import type { FailureReportDiagnostics, FailureReportKind, FailureReportWrite } from '@/api/schemas';

/** Field limits of FailureReport-failure_report.write */
export const REPORT_LIMITS = {
    url: 2048,
    userAgent: 512,
    referrer: 2048,
    comment: 2000,
    errorMessage: 4000,
    diagnosticsField: 100,
} as const;

export type DiagnosticKey = keyof FailureReportDiagnostics;
export const DIAGNOSTIC_KEYS: DiagnosticKey[] = ['downloader', 'downloaderVersion', 'errorMessage', 'clientVersion'];

/** What the extension could gather for a report; the user then picks what to share. */
export interface FailureReportContext {
    kind: FailureReportKind;
    url: string;
    /** IRI of the user's FAILED job (job_failed only) */
    downloadJob: string | null;
    userAgent: string | null;
    referrer: string | null;
    /** Candidate diagnostics (job_failed only); empty values are not offered */
    diagnostics: FailureReportDiagnostics;
}

export interface FailureReportChoices {
    stripQuery: boolean;
    includeUserAgent: boolean;
    includeReferrer: boolean;
    /** Send the full referrer URL instead of its origin */
    fullReferrer: boolean;
    diagnostics: Partial<Record<DiagnosticKey, boolean>>;
    comment: string;
}

/** Query parameter names that commonly carry credentials, sessions or one-time values. */
const SENSITIVE_PARAM = /(^|[_-])(token|access|auth|session|sess|sid|key|apikey|secret|pass(word)?|pwd|sig(nature)?|signed|code|state|nonce|jwt|credential|expires?|hash|otp|ticket)($|[_-])/i;
/** Long opaque values (random ids, signatures) */
const OPAQUE_VALUE = /^[A-Za-z0-9_\-.~%+/=]{24,}$/;

export function isHttpUrl(value: string | null | undefined): value is string {
    if (!value) return false;
    try {
        return /^https?:$/.test(new URL(value).protocol);
    } catch {
        return false;
    }
}

/** True when the URL's query has parameters that look like tokens or session ids. */
export function hasSensitiveQuery(url: string): boolean {
    try {
        const { searchParams } = new URL(url);
        for (const [name, value] of searchParams) {
            if (SENSITIVE_PARAM.test(name) || OPAQUE_VALUE.test(value)) {
                return true;
            }
        }
    } catch {
        // not a URL: nothing to detect
    }
    return false;
}

export function hasQueryOrFragment(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.search !== '' || parsed.hash !== '';
    } catch {
        return false;
    }
}

export function stripQueryAndFragment(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    } catch {
        return url;
    }
}

/** The referrer's origin, e.g. `https://example.com/`; null for non-http(s) values. */
export function referrerOrigin(referrer: string): string | null {
    if (!isHttpUrl(referrer)) return null;
    return `${new URL(referrer).origin}/`;
}

function hasValue(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
}

/** Defaults: optional fields unchecked, query stripped when it looks sensitive, all diagnostics offered unchecked. */
export function defaultChoices(context: FailureReportContext): FailureReportChoices {
    return {
        stripQuery: hasSensitiveQuery(context.url),
        includeUserAgent: false,
        includeReferrer: false,
        fullReferrer: false,
        diagnostics: {},
        comment: '',
    };
}

/** Diagnostics that can be offered for the context (job reports with a non-empty value). */
export function availableDiagnostics(context: FailureReportContext): DiagnosticKey[] {
    if (context.kind !== 'job_failed') return [];
    return DIAGNOSTIC_KEYS.filter((key) => hasValue(context.diagnostics[key]));
}

/** User agent and referrer are always offered (unchecked), independent of what downloads may send. */
export function canOfferUserAgent(context: FailureReportContext): boolean {
    return hasValue(context.userAgent);
}

export function canOfferReferrer(context: FailureReportContext): boolean {
    return isHttpUrl(context.referrer);
}

function truncate(value: string, max: number): string {
    return value.length > max ? value.slice(0, max) : value;
}

/** Builds the exact request body from the gathered context and the user's choices. */
export function composeFailureReport(context: FailureReportContext, choices: FailureReportChoices): FailureReportWrite {
    const body: FailureReportWrite = {
        kind: context.kind,
        url: truncate(choices.stripQuery ? stripQueryAndFragment(context.url) : context.url, REPORT_LIMITS.url),
    };

    if (context.kind === 'job_failed' && context.downloadJob) {
        body.downloadJob = context.downloadJob;
    }

    if (choices.includeUserAgent && canOfferUserAgent(context)) {
        body.userAgent = truncate(context.userAgent!, REPORT_LIMITS.userAgent);
    }

    if (choices.includeReferrer && canOfferReferrer(context)) {
        const referrer = choices.fullReferrer ? context.referrer! : referrerOrigin(context.referrer!);
        if (referrer) {
            body.referrer = truncate(referrer, REPORT_LIMITS.referrer);
        }
    }

    const diagnostics: FailureReportDiagnostics = {};
    for (const key of availableDiagnostics(context)) {
        if (choices.diagnostics[key]) {
            const max = key === 'errorMessage' ? REPORT_LIMITS.errorMessage : REPORT_LIMITS.diagnosticsField;
            diagnostics[key] = truncate(context.diagnostics[key]!, max);
        }
    }
    if (Object.keys(diagnostics).length > 0) {
        body.diagnostics = diagnostics;
    }

    const comment = choices.comment.trim();
    if (comment) {
        body.comment = truncate(comment, REPORT_LIMITS.comment);
    }

    return body;
}
