import React, { useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import { ExternalLink, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { sendMessage } from '@/lib/messaging';
import type { WellKnownIntegrity } from '@/lib/wellKnown';
import type { PrivacyPolicy } from '@/api/schemas';

export interface ServerPrivacyInfoProps {
    privacyPolicyUrl: string | null;
    integrity: WellKnownIntegrity | null;
    /** Server host URL, used if the user opens optional verification details (GET /privacy_policy) */
    host?: string;
    /** 'card' wraps in a bordered box (options, welcome); 'inline' embeds inside an existing card (report form) */
    variant?: 'card' | 'inline';
}

type DetailState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'loaded'; policy: PrivacyPolicy | null };

function integrityLabel(integrity: WellKnownIntegrity): string {
    const version = integrity.appVersion;
    switch (integrity.status) {
        case 'verified':
            return version
                ? i18n.t('serverPrivacy.status.verifiedWithVersion', [version])
                : i18n.t('serverPrivacy.status.verified');
        case 'modified':
            return version
                ? i18n.t('serverPrivacy.status.modifiedWithVersion', [version])
                : i18n.t('serverPrivacy.status.modified');
        case 'unknown':
            return version
                ? i18n.t('serverPrivacy.status.unknownWithVersion', [version])
                : i18n.t('serverPrivacy.status.unknown');
    }
}

function integrityBadgeVariant(status: WellKnownIntegrity['status']): 'success' | 'destructive' | 'warning' {
    switch (status) {
        case 'verified':
            return 'success';
        case 'modified':
            return 'destructive';
        case 'unknown':
            return 'warning';
    }
}

function IntegrityIcon({ status }: { status: WellKnownIntegrity['status'] }) {
    switch (status) {
        case 'verified':
            return <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
        case 'modified':
            return <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
        case 'unknown':
            return <Shield className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    }
}

function formatTimestamp(iso: string): string {
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? iso : new Date(ms).toLocaleString();
}

export function ServerPrivacyInfo({
    privacyPolicyUrl,
    integrity,
    host,
    variant = 'card',
}: ServerPrivacyInfoProps) {
    const [detail, setDetail] = useState<DetailState>({ status: 'idle' });
    const [detailsOpen, setDetailsOpen] = useState(false);
    const requestSeqRef = useRef(0);

    useEffect(() => {
        requestSeqRef.current += 1;
        setDetail({ status: 'idle' });
        setDetailsOpen(false);
    }, [host, privacyPolicyUrl, integrity?.status, integrity?.appVersion]);

    const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
        const open = e.currentTarget.open;
        setDetailsOpen(open);
        if (open && detail.status === 'idle') {
            const seq = ++requestSeqRef.current;
            setDetail({ status: 'loading' });
            sendMessage('getPrivacyPolicy', { host })
                .then((policy) => {
                    if (seq === requestSeqRef.current) {
                        setDetail({ status: 'loaded', policy });
                    }
                })
                .catch(() => {
                    if (seq === requestSeqRef.current) {
                        setDetail({ status: 'loaded', policy: null });
                    }
                });
        }
    };

    const containerClass = variant === 'card'
        ? 'rounded-md border border-border bg-muted/30 p-3 space-y-2.5 text-sm text-foreground'
        : 'pt-2.5 border-t border-border space-y-2 text-xs text-foreground';

    return (
        <div className={containerClass}>
            {/* Privacy policy link or notice */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-muted-foreground">
                    {i18n.t('serverPrivacy.policyLabel')}:
                </span>
                {privacyPolicyUrl ? (
                    <a
                        href={privacyPolicyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-primary"
                    >
                        {i18n.t('serverPrivacy.policyLink')}
                        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                    </a>
                ) : (
                    <span className="text-muted-foreground">
                        {i18n.t('serverPrivacy.noPolicy')}
                    </span>
                )}
            </div>

            {/* Integrity status — omitted completely for older servers without `integrity` */}
            {integrity && (
                <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-muted-foreground">
                            {i18n.t('serverPrivacy.integrityLabel')}:
                        </span>
                        <Badge variant={integrityBadgeVariant(integrity.status)} className="gap-1 font-medium">
                            <IntegrityIcon status={integrity.status} />
                            <span>{integrityLabel(integrity)}</span>
                        </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {i18n.t('serverPrivacy.explanation')}
                    </p>

                    <details open={detailsOpen} onToggle={handleToggle} className="text-xs">
                        <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
                            {i18n.t('serverPrivacy.detailsToggle')}
                        </summary>
                        <div className="mt-2 rounded border border-border bg-background/60 p-2.5 space-y-1.5 text-xs">
                            {detail.status === 'loading' && (
                                <p className="text-muted-foreground">{i18n.t('serverPrivacy.detailsLoading')}</p>
                            )}
                            {detail.status === 'loaded' && !detail.policy && (
                                <p className="text-muted-foreground">{i18n.t('serverPrivacy.detailsUnavailable')}</p>
                            )}
                            {detail.status === 'loaded' && detail.policy && (
                                <dl className="space-y-1">
                                    <div className="grid grid-cols-[8rem_1fr] gap-2">
                                        <dt className="text-muted-foreground">{i18n.t('serverPrivacy.fields.source')}</dt>
                                        <dd>{i18n.t(`serverPrivacy.policySource.${detail.policy.status}`)}</dd>
                                    </div>
                                    {detail.policy.status === 'unavailable' && detail.policy.reason && (
                                        <p className="text-muted-foreground">
                                            {i18n.t(`serverPrivacy.unavailableReason.${detail.policy.reason}`)}
                                        </p>
                                    )}
                                    {detail.policy.revision != null && (
                                        <div className="grid grid-cols-[8rem_1fr] gap-2">
                                            <dt className="text-muted-foreground">{i18n.t('serverPrivacy.fields.revision')}</dt>
                                            <dd>#{detail.policy.revision}</dd>
                                        </div>
                                    )}
                                    {detail.policy.textVersion && (
                                        <div className="grid grid-cols-[8rem_1fr] gap-2">
                                            <dt className="text-muted-foreground">{i18n.t('serverPrivacy.fields.textVersion')}</dt>
                                            <dd>{detail.policy.textVersion}</dd>
                                        </div>
                                    )}
                                    {detail.policy.integrity?.checkedAt && (
                                        <div className="grid grid-cols-[8rem_1fr] gap-2">
                                            <dt className="text-muted-foreground">{i18n.t('serverPrivacy.fields.checkedAt')}</dt>
                                            <dd>{formatTimestamp(detail.policy.integrity.checkedAt)}</dd>
                                        </div>
                                    )}
                                    {detail.policy.integrity?.gitSha && (
                                        <div className="grid grid-cols-[8rem_1fr] gap-2">
                                            <dt className="text-muted-foreground">{i18n.t('serverPrivacy.fields.gitSha')}</dt>
                                            <dd className="font-mono break-all" title={detail.policy.integrity.gitSha}>
                                                {detail.policy.integrity.gitSha.slice(0, 12)}
                                            </dd>
                                        </div>
                                    )}
                                    {detail.policy.integrity?.manifestDigest && (
                                        <div className="grid grid-cols-[8rem_1fr] gap-2">
                                            <dt className="text-muted-foreground">{i18n.t('serverPrivacy.fields.manifestDigest')}</dt>
                                            <dd className="font-mono break-all">{detail.policy.integrity.manifestDigest}</dd>
                                        </div>
                                    )}
                                </dl>
                            )}
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}
