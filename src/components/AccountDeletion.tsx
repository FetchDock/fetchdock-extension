import React, { useEffect, useState } from 'react';
import { i18n } from '#imports';
import { sendMessage } from '@/lib/messaging';
import { accountDeletedNoticeItem, type AccountDeletedNotice } from '@/lib/storageItems';
import { Button } from '@/components/ui/button';

/** Type-to-confirm account deletion (DELETE /users/me?confirm={subject}); the background signs out afterwards. */
export function DeleteAccount() {
    const [open, setOpen] = useState(false);
    const [subject, setSubject] = useState<string | null>(null);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || subject !== null) return;
        sendMessage('getCurrentUser', undefined)
            .then((user) => setSubject(user.subject ?? ''))
            .catch((err) => setError(i18n.t('account.loadFailed', [String(err?.message ?? err)])));
    }, [open, subject]);

    if (!open) {
        return (
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
                {i18n.t('account.deleteTitle')}
            </Button>
        );
    }

    const confirmed = !!subject && typed.trim() === subject;
    const handleDelete = async () => {
        if (!subject || !confirmed) return;
        setBusy(true);
        setError(null);
        try {
            await sendMessage('deleteAccount', { confirm: subject });
        } catch (err: any) {
            setError(i18n.t('account.deleteFailed', [String(err?.message ?? err)]));
            setBusy(false);
        }
    };

    return (
        <div className="mt-3 rounded border border-red-300 dark:border-red-800 p-3">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">{i18n.t('account.deleteTitle')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{i18n.t('account.deleteIntro')}</p>
            {subject === null && !error && <p className="text-sm text-gray-600 mt-2">{i18n.t('account.loading')}</p>}
            {subject && (
                <>
                    <label htmlFor="deleteAccountConfirm" className="block text-sm text-gray-900 dark:text-white mt-2">
                        {i18n.t('account.confirmLabel', [subject])}
                    </label>
                    <input
                        id="deleteAccountConfirm"
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        className="mt-1 border border-gray-300 rounded px-2 py-1 w-full text-black dark:text-white font-mono text-sm"
                    />
                </>
            )}
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            <div className="flex gap-2">
                <Button type="button" variant="destructive" size="sm" disabled={!confirmed || busy} onClick={handleDelete}>
                    {busy ? i18n.t('account.deleting') : i18n.t('account.deleteButton')}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setOpen(false); setTyped(''); setError(null); }}>
                    {i18n.t('account.cancel')}
                </Button>
            </div>
        </div>
    );
}

/** Shown after the extension signed out because the account was deleted, until dismissed or the next sign-in. */
export function AccountDeletedBanner() {
    const [notice, setNotice] = useState<AccountDeletedNotice | null>(null);

    useEffect(() => {
        accountDeletedNoticeItem.getValue().then(setNotice);
        return accountDeletedNoticeItem.watch(setNotice);
    }, []);

    if (!notice) return null;

    return (
        <div role="status" className="mb-4 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <span className="flex-1">
                {i18n.t(notice.fromThisDevice ? 'account.deletedHere' : 'account.deletedElsewhere', [notice.server])}
            </span>
            <button type="button" className="underline" onClick={() => void accountDeletedNoticeItem.removeValue()}>
                {i18n.t('account.dismiss')}
            </button>
        </div>
    );
}
