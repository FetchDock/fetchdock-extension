import {DownloadJob, DownloadJobDTO} from "@/lib/types.ts";


class DownloadManagerService {
    private downloads: Map<string, DownloadJob> = new Map();
    private pushedDownloads: Map<string, DownloadJobDTO> = new Map();
}