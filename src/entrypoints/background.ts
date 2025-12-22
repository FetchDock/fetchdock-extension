import { onMessage } from "@/lib/messaging";
import { getMergedAppConfig, subscribeToAppConfigChanges } from "@/lib/config";

export default defineBackground(() => {

  // Run when the extension is installed, useful for welcome pages or initial setup
  browser.runtime.onInstalled.addListener(() => {
    browser.tabs.create({ url: "https://www.google.com" });
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
    return "Hello from background via messaging! Received: " + message.data;
  });

  console.log('Hello background!', { id: browser.runtime.id });
});
