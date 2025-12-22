import { onMessage } from "@/lib/messaging";
import { getMergedAppConfig, subscribeToAppConfigChanges } from "@/lib/config";
import { apiService } from "@/service/apiService.ts";
import { i18n } from "#imports";

export default defineBackground(() => {

  // Run when the extension is installed, useful for welcome pages or initial setup
  browser.runtime.onInstalled.addListener(() => {
    // browser.tabs.create({ url: "https://www.google.com" });
    console.log("onInstalled event fired");
  });

  // Example of using runtime-updated config in the background
  getMergedAppConfig().then((cfg) => {
    console.log('Loaded runtime app config in background:', cfg);
  }).catch((err) => {
    console.error('Failed to load app config in background', err);
  });

  // Listen for changes to app config and react to them
  subscribeToAppConfigChanges((newConfig, oldConfig) => {
    console.log('App config changed in background', { newConfig, oldConfig });
  });

  onMessage("testMessage", async (message) => {
    console.log(message);
    i18n.t('messages.background.testMessage.return', [message.data])
    return "Hello from background via messaging! Received: " + message.data;
  });

  onMessage("testApiServiceHost", async (message) => {
    const host = message.data as string;

    console.log('Testing API service host from background:', host);

    try {
      const result = await apiService.testHost(host);
      return i18n.t('messages.background.testApiServiceHost.success', [ host ]);
    } catch (err) {
      return i18n.t('messages.background.testApiServiceHost.failure', [ host, `${err}` ]);
      // return `Host ${host} is NOT supported: ${err}`;
    }
  });

  console.log('Hello background!', { id: browser.runtime.id });
});
