import React from 'react';
import { HardDrive, Activity, Download, Settings, KeyRound, LayoutDashboard, Globe } from 'lucide-react';
import { DownloadersPanel } from '@/components/dashboard/resources/DownloadersPanel';
import { DownloadJobsPanel } from '@/components/dashboard/resources/DownloadJobsPanel';
import { SitesPanel } from '@/components/dashboard/resources/SitesPanel';

export interface NavItem {
    id: string;
    label: string;
    /** Short description shown in the command palette */
    description?: string;
    icon: React.ReactNode;
    panel: React.ReactNode;
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
];

export { Settings, KeyRound, LayoutDashboard };

