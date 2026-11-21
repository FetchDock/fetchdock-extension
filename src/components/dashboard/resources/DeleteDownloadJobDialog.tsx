import React from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { sendMessage } from '@/lib/messaging';

interface DeleteDownloadJobDialogProps {
    /** Job to delete; the dialog is open while this is set */
    job: { uuid: string; uri?: string } | null;
    onClose: () => void;
    /** Called after the job is gone (deleted now, or already deleted elsewhere: 404) */
    onDeleted: (uuid: string) => void;
}

/** Confirms and performs DELETE /download_jobs/{uuid} via the background. */
export function DeleteDownloadJobDialog({ job, onClose, onDeleted }: DeleteDownloadJobDialogProps) {
    const [deleting, setDeleting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        setError(null);
        setDeleting(false);
    }, [job?.uuid]);

    const confirm = async () => {
        if (!job) return;
        setDeleting(true);
        setError(null);
        try {
            await sendMessage('deleteDownloadJob', job.uuid);
            onDeleted(job.uuid);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Dialog open={job !== null} onOpenChange={open => { if (!open && !deleting) onClose(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete this download job?</DialogTitle>
                    <DialogDescription>
                        Its files are no longer listed for you. Files still used by other jobs are kept.
                    </DialogDescription>
                </DialogHeader>

                {job?.uri && (
                    <p className="text-xs font-mono break-all text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                        {job.uri}
                    </p>
                )}

                {error && (
                    <p className="text-sm text-destructive flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </p>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
                    <Button variant="destructive" onClick={confirm} disabled={deleting}>
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
