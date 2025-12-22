import type { WxtAppConfig } from '@/lib/types';
import type { DownloadJob } from '@/lib/types';
import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
    getSettings(): WxtAppConfig;
    updateSettings(settings: Partial<WxtAppConfig>): WxtAppConfig;
    getDownloadJobs(): DownloadJob[];
    sendDownloadJob(job: DownloadJob): void;

    testApiServiceHost(host: string): string;

    // test
    testMessage(msg: string): string;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();