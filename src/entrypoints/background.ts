import {onMessage, sendMessage} from "@/lib/messaging";
import {getMergedAppConfig, subscribeToAppConfigChanges} from "@/lib/config";
import {apiService} from "@/service/apiService.ts";
import {i18n} from "#imports";
import {tokenManager} from "@/lib/tokenManager";
import { fetchDiscovery, resolveEndpoint } from "@/lib/fetchUtils";
import {SendMessageOptions} from "@webext-core/messaging";
import {DownloadJobDTO, CookieDTO, RejectedDownloadJob} from "@/lib/types.ts";
import {Browser} from "@wxt-dev/browser";
import {mercureService} from "@/service/mercureService.ts";

export default defineBackground(() => {

  browser.runtime.onInstalled.addListener(async ({reason}) => {
    if (reason === 'install') {
      await browser.tabs.create({
        url: browser.runtime.getURL('/welcome.html'),
        active: true,
      })
    }
  });

  getMergedAppConfig().then((cfg) => {
    console.log('Loaded runtime app config in background:', cfg);
  }).catch((err) => {
    console.error('Failed to load app config in background', err);
  });

  subscribeToAppConfigChanges((newConfig, oldConfig) => {
    console.log('App config changed in background', { newConfig, oldConfig });
  });

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

      browser.contextMenus.onClicked.addListener(async (
          info: Browser.contextMenus.OnClickData,
          tab?: Browser.tabs.Tab
      ) => {
        if(info.menuItemId) {
          console.debug('Context menu item clicked', info);

          const MOCK_URI = 'https://mock.fetchdock.dev/to-be-replaced';

          let downloadJob: DownloadJobDTO = {
            uri: MOCK_URI,
          };

          let caseMatch = false;
          switch (info.menuItemId) {
            case 'sendLinkToDownloadServer':
              if (info.linkUrl) {
                downloadJob.uri = info.linkUrl;
                caseMatch = true;
              }
              break;
            case 'sentVideoToDownloadServer':
            case 'sentImageToDownloadServer':
              if (info.srcUrl) {
                downloadJob.uri = info.srcUrl;
                caseMatch = true;
              }
              break;
            case 'sentPageToDownloadServer':
              if (info.frameUrl) {
                downloadJob.uri = info.frameUrl;
                caseMatch = true;
              }
              break;
            default:
              console.error('Unknown menu item clicked', info, tab);
              return;
          }

          // Check if the sendCookie setting has been enabled, if so we'll try to get the cookies for the link domain
          const {sendCookies, sendReferrer, sendUserAgent} = await getMergedAppConfig();
          if (sendCookies) {
            downloadJob.cookies = await new Promise<CookieDTO[]>((resolve) => {
              browser.cookies.getAll({url: downloadJob.uri}, (cookies) => {
                const collected: CookieDTO[] = [];

                for (const cookie of cookies) {
                  const payloadCookie: CookieDTO = {
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path,
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly,
                    sameSite: cookie.sameSite,
                  };
                  if (cookie.expirationDate !== undefined) {
                    // Convert floating-point epoch seconds to ISO-8601 datetime string
                    const epochMs: number = cookie.expirationDate * 1000;
                    payloadCookie.expirationDate = new Date(epochMs).toISOString();
                  }
                  collected.push(payloadCookie);
                }

                resolve(collected);
              });
            });
          }

          if (sendReferrer) {
            console.log('Sending referrer:', tab?.url);
          }

          if (sendUserAgent) {
            downloadJob.userAgent = navigator.userAgent;
          }

          if (caseMatch) {
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
                  // the user when it reaches a terminal state (completed/failed/cancelled).
                  // The hub URL can optionally be discovered from the `Link` response
                  // header of the POST /download_jobs call; pass it here once available.
                  if (job?.token && tabId != null) {
                    mercureService.trackJob(job.token, tabId, downloadJob.uri /*, hubUrl */);
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
      const tokenEndpoint: string | undefined = data?.oauth2?.token_endpoint;
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

    // Close the popup tab now that we have the token
    if (result.tabId != null) {
      browser.tabs.remove(result.tabId).catch((err) => {
        console.warn('Could not close OAuth2 popup tab:', err);
      });
    }

    return true;
  });
});
