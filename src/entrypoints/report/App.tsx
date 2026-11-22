import React from 'react';
import { i18n } from '#imports';
import { AlertCircle, CheckCircle2, Flag, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendMessage } from '@/lib/messaging';
import { useTheme } from '@/lib/useTheme';
import optionsStorage from '@/utils/optionsStorage';
import type { ServerFeatures } from '@/lib/wellKnown';
import type { FailureReport, FailureReportWrite } from '@/api/schemas';
import {
    availableDiagnostics,
    canOfferReferrer,
    canOfferUserAgent,
    composeFailureReport,
    defaultChoices,
    hasQueryOrFragment,
    hasSensitiveQuery,
    referrerOrigin,
    REPORT_LIMITS,
    type DiagnosticKey,
    type FailureReportChoices,
    type FailureReportContext,
} from '@/lib/failureReport';

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | { status: 'disabled' }
    | { status: 'ready'; context: FailureReportContext; features: ServerFeatures; server: string };

type SendState =
    | { status: 'idle' }
    | { status: 'sending' }
    | { status: 'sent'; report: FailureReport }
    | { status: 'error'; error: string };

/** Labels of the body's fields, in the order they are listed */
const FIELD_LABELS: Record<string, () => string> = {
    kind: () => i18n.t('report.fields.kind'),
    url: () => i18n.t('report.fields.url'),
    downloadJob: () => i18n.t('report.fields.downloadJob'),
    userAgent: () => i18n.t('report.fields.userAgent'),
    referrer: () => i18n.t('report.fields.referrer'),
    comment: () => i18n.t('report.fields.comment'),
};

const DIAGNOSTIC_LABELS: Record<DiagnosticKey, () => string> = {
    downloader: () => i18n.t('report.fields.downloader'),
    downloaderVersion: () => i18n.t('report.fields.downloaderVersion'),
    errorMessage: () => i18n.t('report.fields.errorMessage'),
    clientVersion: () => i18n.t('report.fields.clientVersion'),
};

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
            {children}
        </section>
    );
}

function Check({ checked, onChange, label, value, disabled }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    value?: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={checked} disabled={disabled}
                   onChange={(e) => onChange(e.target.checked)} />
            <span className="min-w-0 flex-1">
                <span>{label}</span>
                {value != null && (
                    <span className="block font-mono text-xs text-muted-foreground break-all whitespace-pre-wrap max-h-40 overflow-auto">
                        {value}
                    </span>
                )}
            </span>
        </label>
    );
}

function Note({ children }: { children: React.ReactNode }) {
    return <p className="text-xs text-muted-foreground">{children}</p>;
}

/** Every value of the body, as listed for the user; nested diagnostics are flattened. */
function readableEntries(body: FailureReportWrite): Array<{ key: string; label: string; value: string }> {
    const entries: Array<{ key: string; label: string; value: string }> = [];
    for (const [key, value] of Object.entries(body)) {
        if (key === 'diagnostics' && value && typeof value === 'object') {
            for (const [diagKey, diagValue] of Object.entries(value)) {
                const label = DIAGNOSTIC_LABELS[diagKey as DiagnosticKey]?.() ?? diagKey;
                entries.push({ key: `diagnostics.${diagKey}`, label, value: String(diagValue) });
            }
        } else if (value != null) {
            const display = key === 'kind' ? i18n.t(`report.kinds.${value as 'job_failed' | 'unsupported_url'}`) : String(value);
            entries.push({ key, label: FIELD_LABELS[key]?.() ?? key, value: display });
        }
    }
    return entries;
}

function ReportForm({ context, features, server }: { context: FailureReportContext; features: ServerFeatures; server: string }) {
    const [choices, setChoices] = React.useState<FailureReportChoices>(() => defaultChoices(context));
    const [send, setSend] = React.useState<SendState>({ status: 'idle' });
    const body = React.useMemo(() => composeFailureReport(context, choices), [context, choices]);

    const update = (patch: Partial<FailureReportChoices>) => setChoices((prev) => ({ ...prev, ...patch }));
    const toggleDiagnostic = (key: DiagnosticKey, on: boolean) =>
        setChoices((prev) => ({ ...prev, diagnostics: { ...prev.diagnostics, [key]: on } }));

    const diagnostics = availableDiagnostics(context);
    const offerUserAgent = canOfferUserAgent(context);
    const offerReferrer = canOfferReferrer(context);
    const isJob = context.kind === 'job_failed';
    const locked = send.status === 'sending' || send.status === 'sent';

    const submit = async () => {
        setSend({ status: 'sending' });
        try {
            // Exactly the body shown in "What will be shared"
            const report = await sendMessage('submitFailureReport', body);
            setSend({ status: 'sent', report });
        } catch (err) {
            setSend({ status: 'error', error: errorMessage(err) });
        }
    };

    const openReports = async () => {
        const url = await sendMessage('getExtensionPageUrl', '/dashboard.html#reports');
        window.open(url);
    };

    return (
        <div className="space-y-6">
            <p className="text-sm">{i18n.t('report.intro')}</p>

            <Section title={i18n.t('report.sections.page')}>
                <p className="text-sm">
                    <span className="text-muted-foreground">{i18n.t('report.fields.kind')}: </span>
                    {i18n.t(`report.kinds.${context.kind}`)}
                </p>
                <p className="font-mono text-xs break-all rounded-md bg-muted/50 px-3 py-2">{context.url}</p>
                {hasQueryOrFragment(context.url) && (
                    <>
                        <Check checked={choices.stripQuery} disabled={locked}
                               onChange={(stripQuery) => update({ stripQuery })}
                               label={i18n.t('report.stripQuery')} />
                        {hasSensitiveQuery(context.url) && <Note>{i18n.t('report.stripQueryHint')}</Note>}
                    </>
                )}
            </Section>

            <Section title={i18n.t('report.sections.optional')}>
                {offerUserAgent && (
                    <Check checked={choices.includeUserAgent} disabled={locked}
                           onChange={(includeUserAgent) => update({ includeUserAgent })}
                           label={i18n.t('report.fields.userAgent')} value={context.userAgent} />
                )}
                {!isJob && (offerReferrer ? (
                    <>
                        <Check checked={choices.includeReferrer} disabled={locked}
                               onChange={(includeReferrer) => update({ includeReferrer })}
                               label={i18n.t('report.fields.referrer')}
                               value={choices.fullReferrer ? context.referrer : referrerOrigin(context.referrer!)} />
                        {choices.includeReferrer && (
                            <div className="pl-6">
                                <Check checked={choices.fullReferrer} disabled={locked}
                                       onChange={(fullReferrer) => update({ fullReferrer })}
                                       label={i18n.t('report.fullReferrer')} />
                            </div>
                        )}
                    </>
                ) : (
                    <Note>{i18n.t('report.noReferrer')}</Note>
                ))}
            </Section>

            {isJob && (
                <Section title={i18n.t('report.sections.diagnostics')}>
                    {diagnostics.length === 0 && <Note>{i18n.t('report.noDiagnostics')}</Note>}
                    {diagnostics.map((key) => (
                        <Check key={key} checked={!!choices.diagnostics[key]} disabled={locked}
                               onChange={(on) => toggleDiagnostic(key, on)}
                               label={DIAGNOSTIC_LABELS[key]()} value={context.diagnostics[key]} />
                    ))}
                </Section>
            )}

            <Section title={i18n.t('report.sections.comment')}>
                <textarea
                    className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder={i18n.t('report.commentPlaceholder')}
                    maxLength={REPORT_LIMITS.comment}
                    value={choices.comment}
                    disabled={locked}
                    onChange={(e) => update({ comment: e.target.value })}
                />
                <div className="flex justify-between">
                    <Note>{i18n.t('report.commentHint')}</Note>
                    <Note>{i18n.t('report.characters', [String(choices.comment.length), String(REPORT_LIMITS.comment)])}</Note>
                </div>
            </Section>

            <Section title={i18n.t('report.sections.shared')}>
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> {i18n.t('report.sentTo', [server])}
                    </p>
                    <dl className="space-y-1.5">
                        {readableEntries(body).map((entry) => (
                            <div key={entry.key} className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
                                <dt className="text-muted-foreground">{entry.label}</dt>
                                <dd className="font-mono text-xs break-all whitespace-pre-wrap">{entry.value}</dd>
                            </div>
                        ))}
                    </dl>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{i18n.t('report.json')}</p>
                        <pre className="text-xs font-mono rounded-md bg-muted/50 p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                            {JSON.stringify(body, null, 2)}
                        </pre>
                    </div>
                    <Note>{i18n.t('report.serverAdds')}</Note>
                    <p className="text-xs">
                        {features.privacyPolicyUrl ? (
                            <a href={features.privacyPolicyUrl} target="_blank" rel="noreferrer" className="underline">
                                {i18n.t('report.policy')}
                            </a>
                        ) : (
                            <span className="text-muted-foreground">{i18n.t('report.noPolicy')}</span>
                        )}
                    </p>
                </div>
            </Section>

            {send.status === 'error' && (
                <p className="text-sm text-destructive flex items-start gap-1.5 whitespace-pre-line">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {i18n.t('report.failed', [send.error])}
                </p>
            )}

            {send.status === 'sent' ? (
                <div className="space-y-3">
                    <p className="text-sm flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {i18n.t('report.sent')}
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={openReports}>{i18n.t('report.openReports')}</Button>
                        <Button onClick={() => window.close()}>{i18n.t('report.close')}</Button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2">
                    <Button onClick={submit} disabled={send.status === 'sending'}>
                        {send.status === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
                        {send.status === 'sending' ? i18n.t('report.sending') : i18n.t('report.submit')}
                    </Button>
                    <Button variant="outline" onClick={() => window.close()} disabled={send.status === 'sending'}>
                        {i18n.t('report.cancel')}
                    </Button>
                </div>
            )}
        </div>
    );
}

function App() {
    useTheme();
    const [state, setState] = React.useState<LoadState>({ status: 'loading' });

    const params = React.useMemo(() => new URLSearchParams(window.location.search), []);
    const jobUuid = params.get('job') ?? undefined;

    React.useEffect(() => {
        (async () => {
            const features = await sendMessage('getServerFeatures', { force: true });
            if (!features.failureReports) {
                setState({ status: 'disabled' });
                return;
            }
            const [context, opts] = await Promise.all([
                sendMessage('getFailureReportContext', {
                    jobUuid,
                    url: params.get('url') ?? undefined,
                    referrer: params.get('referrer') ?? undefined,
                }),
                optionsStorage.getAll(),
            ]);
            const server = String(opts.downloadRouterServerHost ?? '').replace(/\/+$/, '');
            setState({ status: 'ready', context, features, server });
        })().catch((err) => setState({ status: 'error', error: errorMessage(err) }));
    }, [jobUuid, params]);

    const title = state.status === 'ready'
        ? i18n.t(state.context.kind === 'job_failed' ? 'report.titleJob' : 'report.titleUrl')
        : i18n.t('report.title');

    React.useEffect(() => { document.title = `FetchDock — ${title}`; }, [title]);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-2xl mx-auto p-6 space-y-6">
                <header className="flex items-center gap-2.5">
                    <Flag className="w-5 h-5 text-muted-foreground" />
                    <h1 className="text-lg font-semibold">{title}</h1>
                </header>

                {state.status === 'loading' && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> {i18n.t('report.loading')}
                    </p>
                )}
                {state.status === 'disabled' && <p className="text-sm">{i18n.t('report.disabled')}</p>}
                {state.status === 'error' && (
                    <p className="text-sm text-destructive flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {i18n.t('report.loadFailed', [state.error])}
                    </p>
                )}
                {state.status === 'ready' && <ReportForm context={state.context} features={state.features} server={state.server} />}
            </div>
        </div>
    );
}

export default App;
