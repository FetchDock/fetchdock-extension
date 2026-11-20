import { apiService } from '@/service/apiService';
import { getMergedAppConfig } from '@/lib/config';
import { tokenManager } from '@/lib/tokenManager';
import { clientRegistrationItem } from '@/lib/storageItems';
import { CLIENT_TYPE } from '@/api/schemas';

let inFlight: Promise<string | null> | null = null;

async function currentServer(): Promise<string> {
    return ((await getMergedAppConfig()).downloadRouterServerHost ?? '').replace(/\/+$/, '');
}

function clientName(): string {
    const browserName = import.meta.env.BROWSER ?? 'browser';
    return `FetchDock extension (${browserName.charAt(0).toUpperCase()}${browserName.slice(1)})`;
}

/** The id this device registered with on the configured server, or null. */
export async function getClientId(): Promise<string | null> {
    const registration = await clientRegistrationItem.getValue();
    return registration && registration.server === await currentServer() ? registration.id : null;
}

/**
 * Registers this device in the user's client registry once per server (POST /users/clients) and stores the id;
 * the API service then sends it as X-Client-Id. No-op without a server or authentication.
 */
export function ensureClientRegistered(): Promise<string | null> {
    inFlight ??= doEnsure().finally(() => { inFlight = null; });
    return inFlight;
}

async function doEnsure(): Promise<string | null> {
    const existing = await getClientId();
    if (existing) {
        return existing;
    }

    const server = await currentServer();
    if (!server || (await tokenManager.getTokenState()).status === 'none') {
        return null;
    }

    try {
        const client = await apiService.registerClient({ name: clientName(), type: CLIENT_TYPE });
        if (!client.id) {
            console.warn('[clientRegistry] Server did not return a client id');
            return null;
        }
        await clientRegistrationItem.setValue({ id: client.id, server });
        console.info('[clientRegistry] Registered client', client.id);
        return client.id;
    } catch (err) {
        console.warn('[clientRegistry] Client registration failed:', err);
        return null;
    }
}

/** Drops the stored registration (e.g. revoked on the server) and registers again. */
export async function reregisterClient(): Promise<string | null> {
    await clientRegistrationItem.setValue(null);
    return ensureClientRegistered();
}
