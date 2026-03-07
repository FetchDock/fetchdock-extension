import {DownloadJob} from "@/lib/types.ts";
import {DownloadJobDownloadJobDTO} from "@/service/api";


class DownloadManagerService {
    private downloads: Map<string, DownloadJob> = new Map();
    private pushedDownloads: Map<string, DownloadJobDownloadJobDTO> = new Map();
}