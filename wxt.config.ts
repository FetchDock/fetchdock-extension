import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: [
      '@wxt-dev/module-react',
      '@wxt-dev/i18n/module',
      'wxt-module-console-forward',
  ],
  dev: {
    server: {
      port: 5175,
    }
  },
  consoleForward: {
    enabled: true,
    levels: ['error', 'warn', 'info', 'debug', 'log'],
    endpoint: '/api/debug/client-logs',
    forwardErrors: true,
  },
  manifest: {
    permissions: [
        "activeTab",
        "clipboardRead",
        "clipboardWrite",
        "contextMenus",
        "cookies",
        "scripting",
        "storage",
        "tabs",
        "webRequest",
    ],
    name: "FetchDock",
    description: "Companion extension for FetchDock Server",
    version: '0.1.0',
    browser_specific_settings: {
      gecko: {
        id: 'fetchdock@pbxg33k.eu', // Required as temp addon ID are not permitted to use storage API
        // @ts-ignore
        data_collection_permissions: {
            required: ['none']
        }
      }
    },
    default_locale: 'en',
  }
});
