import { onMessage } from '@/lib/messaging';
import { apiService } from '@/service/apiService';
import { clearSiteResolveCache, invalidateSite, resolveSite } from '@/service/siteResolver';
import { ensureClientRegistered, reregisterClient } from '@/service/clientRegistry';
import { serverUserSettingsItem } from '@/lib/storageItems';

/**
 * Turns the API service's `{ status, body }` rejections into Errors with a readable message,
 * since messaging only carries an Error's message across contexts.
 */
function toError(err: any): Error {
    if (err instanceof Error) {
        return err;
    }
    const body = err?.body;
    const violations: string | undefined = Array.isArray(body?.violations)
        ? body.violations.map((v: any) => (v.propertyPath ? `${v.propertyPath}: ${v.message}` : v.message)).join('\n')
        : undefined;
    const detail = violations ?? body?.detail ?? body?.description ?? body?.title ?? (typeof body === 'string' ? body : undefined);
    return new Error(detail ? `${detail} (${err?.status})` : `Request failed (${err?.status ?? 'network error'})`);
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        throw toError(err);
    }
}

/** Message handlers for sites and the settings layers. Every change invalidates the affected resolutions. */
export function registerSettingsHandlers(): void {
    onMessage('resolveSite', ({ data }) => resolveSite(data.url, { force: data.force }));

    onMessage('getUserSettings', () => call(async () => {
        const settings = await apiService.getUserSettings();
        await serverUserSettingsItem.setValue(settings);
        return settings;
    }));

    onMessage('putUserSettings', ({ data }) => call(async () => {
        const settings = await apiService.putUserSettings(data);
        await serverUserSettingsItem.setValue(settings);
        await clearSiteResolveCache();
        return settings;
    }));

    onMessage('getClientSettings', () => call(async () => {
        const clientId = await ensureClientRegistered();
        if (!clientId) {
            return null;
        }
        try {
            return await apiService.getClientSettings(clientId);
        } catch (err: any) {
            // Revoked on the server: register again
            if (err?.status !== 404) {
                throw err;
            }
            const newId = await reregisterClient();
            return newId ? await apiService.getClientSettings(newId) : null;
        }
    }));

    onMessage('putClientSettings', ({ data }) => call(async () => {
        const clientId = await ensureClientRegistered();
        if (!clientId) {
            throw new Error('This device is not registered with the server; authenticate first.');
        }
        const settings = await apiService.putClientSettings(clientId, data);
        await clearSiteResolveCache();
        return settings;
    }));

    onMessage('listUserDownloaderSettings', () => call(() => apiService.listUserDownloaderSettings()));

    onMessage('putUserDownloaderSettings', ({ data }) => call(async () => {
        const settings = await apiService.putUserDownloaderSettings(data.downloader, data.settings);
        await clearSiteResolveCache();
        return settings;
    }));

    onMessage('listSites', ({ data }) => call(() => apiService.listSites(data)));
    onMessage('getSite', ({ data }) => call(() => apiService.getSite(data)));
    onMessage('listUserSiteSettings', () => call(() => apiService.listUserSiteSettings()));

    onMessage('getUserSiteSettings', ({ data }) => call(() => apiService.getUserSiteSettings(data)));

    onMessage('putUserSiteSettings', ({ data }) => call(async () => {
        const settings = await apiService.putUserSiteSettings(data.slug, data.settings);
        await invalidateSite(data.slug);
        return settings;
    }));

    onMessage('resetUserSiteSettings', ({ data }) => call(async () => {
        await apiService.deleteUserSiteSettings(data);
        await invalidateSite(data);
    }));

    onMessage('getDownloaderOptionsSchema', ({ data }) => call(() => apiService.getDownloaderOptionsSchema(data)));
}
