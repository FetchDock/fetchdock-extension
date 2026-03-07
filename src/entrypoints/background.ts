import {onMessage} from "@/lib/messaging";
import {getMergedAppConfig, subscribeToAppConfigChanges} from "@/lib/config";
import {apiService} from "@/service/apiService.ts";
import {i18n} from "#imports";
import {tokenManager} from "@/lib/tokenManager";

export default defineBackground(() => {

  browser.runtime.onInstalled.addListener(() => {
    console.log("onInstalled event fired");
  });

  getMergedAppConfig().then((cfg) => {
    console.log('Loaded runtime app config in background:', cfg);
  }).catch((err) => {
    console.error('Failed to load app config in background', err);
  });

  subscribeToAppConfigChanges((newConfig, oldConfig) => {
    console.log('App config changed in background', { newConfig, oldConfig });
  });

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

  console.log('Hello background!', { id: browser.runtime.id });
});
