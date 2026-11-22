import React from 'react';
import { HardDrive, Activity, Download, Settings, KeyRound, LayoutDashboard, Globe, Flag } from 'lucide-react';
import { i18n } from '#imports';
import { DownloadersPanel } from '@/components/dashboard/resources/DownloadersPanel';
import { DownloadJobsPanel } from '@/components/dashboard/resources/DownloadJobsPanel';
import { SitesPanel } from '@/components/dashboard/resources/SitesPanel';
import { FailureReportsPanel } from '@/components/dashboard/resources/FailureReportsPanel';
import type { ServerFeatures } from '@/lib/wellKnown';

export interface NavItem {
    id: string;
    label: string;
    /** Short description shown in the command palette */
    description?: string;
    icon: React.ReactNode;
    panel: React.ReactNode;
    /** Only shown when the server announces this feature */
    requires?: keyof Pick<ServerFeatures, 'failureReports'>;
}

export const NAV_ITEMS: NavItem[] = [
    {
        id: 'downloaders',
        label: 'Downloaders',
        description: 'View configured downloader backends',
        icon: <HardDrive className="w-4 h-4" />,
        panel: <DownloadersPanel />,
    },
    {
        id: 'download-jobs',
        label: 'Download Jobs',
        description: 'Browse all submitted download jobs',
        icon: <Download className="w-4 h-4" />,
        panel: <DownloadJobsPanel />,
    },
    {
        id: 'sites',
        label: 'Sites',
        description: 'Supported sites and your site-specific settings',
        icon: <Globe className="w-4 h-4" />,
        panel: <SitesPanel />,
    },
    {
        id: 'reports',
        label: i18n.t('report.list.title'),
        description: i18n.t('report.list.description'),
        icon: <Flag className="w-4 h-4" />,
        panel: <FailureReportsPanel />,
        requires: 'failureReports',
    },
];

/** The nav items the server supports. */
export function availableNavItems(features: ServerFeatures): NavItem[] {
    return NAV_ITEMS.filter((item) => !item.requires || features[item.requires]);
}

export { Settings, KeyRound, LayoutDashboard };

