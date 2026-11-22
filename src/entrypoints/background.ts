import {onMessage, sendMessage} from "@/lib/messaging";
import {getMergedAppConfig, subscribeToAppConfigChanges} from "@/lib/config";
import {apiService} from "@/service/apiService.ts";
import {i18n} from "#imports";
import {tokenManager} from "@/lib/tokenManager";
import { fetchDiscovery, resolveEndpoint } from "@/lib/fetchUtils";
import { wellKnownTokenEndpoint } from "@/lib/wellKnown";
import {SendMessageOptions} from "@webext-core/messaging";
import {RejectedDownloadJob} from "@/lib/types.ts";
import {Browser} from "@wxt-dev/browser";
import {mercureService} from "@/service/mercureService.ts";
import {migrateOptionsToLocalStorage} from "@/utils/optionsStorage";
import {buildDownloadJob} from "@/service/downloadJobBuilder";
import {ensureClientRegistered} from "@/service/clientRegistry";
import {clearSiteResolveCache} from "@/service/siteResolver";
import {preferencesChanged, pushPreferences, syncPreferences} from "@/service/preferencesSync";
import {registerSettingsHandlers} from "@/service/settingsHandlers";
import {openReportForm, registerFailureReportHandlers, REPORT_PAGE_MENU_ID, updateReportMenu} from "@/service/failureReports";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async ({reason}) => {
    if (reason === 'install') {
      await browser.tabs.create({
        url: browser.runtime.getURL('/welcome.html'),
        active: true,
      })
    }
  });

  // Options moved from storage.sync to storage.local; run before anything relies on the stored options
  migrateOptionsToLocalStorage()
    .catch((err) => console.error('Failed to migrate options to storage.local', err))
    .then(() => getMergedAppConfig())
    .then(async (cfg) => {
      console.log('Loaded runtime app config in background:', cfg);
      if (cfg.oauth2AccessToken) {
        await ensureClientRegistered();
        if (cfg.useServerSettings) {
          await syncPreferences();
        }
      }
    })
    .catch((err) => {
      console.error('Failed to load app config in background', err);
    });

  let pushPreferencesTimer: ReturnType<typeof setTimeout> | undefined;

  subscribeToAppConfigChanges(async (newConfig, oldConfig) => {
    const hostChanged = newConfig.downloadRouterServerHost !== oldConfig.downloadRouterServerHost;
    const authenticated = !!newConfig.oauth2AccessToken;

    if (hostChanged) {
      await clearSiteResolveCache();
    }
    if (hostChanged || (authenticated && !oldConfig.oauth2AccessToken)) {
      void updateReportMenu();
    }
    if (authenticated && (hostChanged || !oldConfig.oauth2AccessToken)) {
      await ensureClientRegistered();
    }
    if (!authenticated || !newConfig.useServerSettings) {
      return;
    }

    if (!oldConfig.useServerSettings || hostChanged || !oldConfig.oauth2AccessToken) {
      await syncPreferences();
    } else if (preferencesChanged(newConfig, oldConfig)) {
      // Debounced: the shortcut recorder and theme toggle may write several times in a row
      clearTimeout(pushPreferencesTimer);
      pushPreferencesTimer = setTimeout(() => {
        pushPreferences().catch((err) => console.warn('Failed to push client preferences', err));
      }, 1000);
    }
  });

  registerSettingsHandlers();
  registerFailureReportHandlers();

  if(typeof browser !== 'undefined') {
    if(typeof browser.contextMenus !== 'undefined') {

      browser.contextMenus.create({
        id: 'sendLinkToDownloadServer',
        title: 'Send Link to FetchDock',
        contexts: ['link']
      });

      browser.contextMenus.create({
        id: 'sentPageToDownloadServer',
        title: 'Sent Page to FetchDock',
        contexts: ['page']
      });

      browser.contextMenus.create({
        id: 'sentImageToDownloadServer',
        title: 'Sent Image to FetchDock',
        contexts: ['image']
      });

      // Shown once the server announces failure reports (updateReportMenu)
      browser.contextMenus.create({
        id: REPORT_PAGE_MENU_ID,
        title: 'Report a problem with this page',
        contexts: ['page'],
        visible: false,
      });
      void updateReportMenu();

      browser.contextMenus.onClicked.addListener(async (
          info: Browser.contextMenus.OnClickData,
          tab?: Browser.tabs.Tab
      ) => {
        if (info.menuItemId === REPORT_PAGE_MENU_ID) {
          const url = info.frameUrl ?? info.pageUrl ?? tab?.url;
          if (url) {
            openReportForm({ url, tabId: info.frameUrl ? undefined : tab?.id })
                .catch((err) => console.error('Failed to open the report form', err));
          }
          return;
        }

        if(info.menuItemId) {
          console.debug('Context menu item clicked', info);

          let uri: string | undefined;
          switch (info.menuItemId) {
            case 'sendLinkToDownloadServer':
              uri = info.linkUrl;
              break;
            case 'sentVideoToDownloadServer':
            case 'sentImageToDownloadServer':
              uri = info.srcUrl;
              break;
            case 'sentPageToDownloadServer':
              uri = info.frameUrl ?? info.pageUrl;
              break;
            default:
              console.error('Unknown menu item clicked', info, tab);
              return;
          }

          if (!uri) {
            return;
          }

          // Resolves the site and attaches cookies / user agent / referrer as the effective settings allow
          const pageUrl = info.menuItemId === 'sentPageToDownloadServer' ? undefined : (info.pageUrl ?? tab?.url);
          const downloadJob = await buildDownloadJob(uri, pageUrl);

          // Context-menu clicks always originate from a tab, but the type is optional.
          const tabId = tab?.id;

          apiService.submitDownloadJob(downloadJob)
              .then((job: any) => {
                if (tabId != null) {
                  const sendMessageOptions: SendMessageOptions = { tabId };
                  sendMessage("acceptedDownloadJob", job, sendMessageOptions);
                }
                console.log('Download job created:', job);

                // Register the job with the Mercure service so we can notify
                // the user when it completes or fails.
                if (job?.token && tabId != null) {
                  mercureService.trackJob({ jobUuid: job.jobUuid, token: job.token }, tabId, downloadJob.uri);
                }
              })
              .catch((err: any) => {
                console.error('Failed to create download job:', err);

                // Send a rejection notification when the server explicitly rejects the
                // job (4xx). Network errors and 5xx responses are intentionally excluded
                // here — those will be covered by error-reporting features in the future.
                if (tabId != null && err && typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
                  const body = err.body;
                  const serverMessage: string | undefined =
                      body?.detail ??
                      body?.['hydra:description'] ??
                      body?.message ??
                      undefined;

                  const rejected: RejectedDownloadJob = {
                    uri: downloadJob.uri,
                    status: err.status,
                    message: serverMessage,
                  };

                  sendMessage("rejectedDownloadJob", rejected, { tabId });
                }
              });
        }
      })
    }
  }

  onMessage("testMessage", async (message) => {
    console.log(message);
    i18n.t('messages.background.testMessage.return', [message.data]);
    return "Hello from background via messaging! Received: " + message.data;
  });

  onMessage("testApiServiceHost", async (message) => {
    const host = message.data as string;
    console.log('Testing API service host from background:', host);
    try {
      const result = await apiService.testHost(host);
      return i18n.t('messages.background.testApiServiceHost.success', [host, result?.authMode, result?.version]);
    } catch (err) {
      return i18n.t('messages.background.testApiServiceHost.failure', [host, `${err}`]);
    }
  });

  onMessage("testApiServiceHostV2", async (message) => {
    const host = message.data as string;
    try {
      const result = await apiService.testHost(host);
      return {
        success: true,
        host: host,
        authMode: result?.authMode,
        version: result?.version,
        // supportedFeatures: result?.supportedFeatures,
        // supportedDownloaders: result?.supportedDownloaders,
        // supportedSites: result?.supportedSites,
        // supportedCommands: result?.supportedCommands,
        // supportedEvents: result?.supportedEvents,
        // supportedFileTypes: result?.supportedFileTypes,
        message: i18n.t('messages.background.testApiServiceHostV2.success', [host, result?.authMode, result?.version]),
      };
    } catch (err) {
      return {
        success: false,
        host: host,
        message: i18n.t('messages.background.testApiServiceHostV2.failure', [host, `${err}`]),
      }
    }
  })

  onMessage("getOAuth2AuthorizationUrl", async (message) => {
    const host = message.data as string;
    console.log('Getting OAuth2 authorization URL for host:', host);
    return await apiService.getOAuth2AuthorizationUrl(host);
  });

  onMessage("oauth2CallbackReceived", (message) => {
    console.log('OAuth2 callback received by background:', message.data);
    // Tokens were already stored by the storeOAuth2Tokens call in the content script.
    // This handler exists so the content script's sendMessage resolves cleanly.
  });

  onMessage("revokeOAuth2Tokens", async () => {
    await tokenManager.revokeTokens();
    return true;
  });

  onMessage("submitDownloadJob", async (message) => {
    return await apiService.submitDownloadJob(message.data);
  });

  onMessage("deleteDownloadJob", async ({ data: uuid }) => {
    try {
      const deleted = await apiService.deleteDownloadJob(uuid);
      // Gone either way: stop waiting for its updates
      mercureService.untrackJobByUuid(uuid);
      return { deleted };
    } catch (err: any) {
      const detail = err?.body?.detail ?? err?.body?.description ?? err?.body?.title ?? err?.message;
      const status = err?.status === 403 ? 'You are not allowed to delete this download job' : 'Deleting the download job failed';
      throw new Error(detail ? `${status}: ${detail}` : `${status} (${err?.status ?? 'network error'})`);
    }
  });

  onMessage("refreshOAuth2Tokens", async () => {
    const cfg = await getMergedAppConfig();
    const base = (cfg.downloadRouterServerHost ?? '').replace(/\/+$/, '');
    if (!base) {
      console.warn('[background] refreshOAuth2Tokens: no server host configured');
      return false;
    }
    try {
      const res = await fetchDiscovery(`${base}/.well-known/browser-extension`);
      if (!res.ok) return false;
      const data = await res.json();
      const tokenEndpoint = wellKnownTokenEndpoint(data);
      if (!tokenEndpoint) {
        console.warn('[background] refreshOAuth2Tokens: no token_endpoint in well-known');
        return false;
      }
      const fullEndpoint = resolveEndpoint(tokenEndpoint, base);
      const newToken = await tokenManager.refresh(fullEndpoint);
      return newToken !== null;
    } catch (err) {
      console.error('[background] refreshOAuth2Tokens failed:', err);
      return false;
    }
  });

  onMessage("openOptionsPage", () => {
    browser.runtime.openOptionsPage();
  });

  onMessage("getExtensionPageUrl", (message) => {
    return browser.runtime.getURL(message.data as any);
  });

  onMessage("storeOAuth2Tokens", async (message) => {
    const result = message.data as {
      success: boolean;
      access_token?: string | null;
      refresh_token?: string | null;
      expires_in?: number | null;
      error?: string;
      error_description?: string;
      tabId?: number;
    };

    if (!result.success || !result.access_token) {
      console.error('OAuth2 authentication failed:', result.error, result.error_description);
      return false;
    }

    try {
      await tokenManager.storeTokens(result);
    } catch (err) {
      console.error('Failed to store OAuth2 tokens:', err);
      return false;
    }

    return true;
  });
});
