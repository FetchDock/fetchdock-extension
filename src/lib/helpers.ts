import { DownloadJob } from '@/lib/types';
import { sendMessage } from "@/lib/messaging.ts";

export function fetchDownloadJobs(): Promise<DownloadJob[]> {
    try {
        return sendMessage("getDownloadJobs");
    } catch (error) {
        console.error("Error fetching download jobs:", error);
        return Promise.resolve([]);
    }
}