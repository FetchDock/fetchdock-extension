import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: [
      '@wxt-dev/module-react',
      '@wxt-dev/i18n/module'
  ],
  manifest: {
    permissions: [
        "storage",
    ],
    name: "Download Router companion extension",
    description: "Companion extension for Download Router app",
    version: '0.1.0',
    browser_specific_settings: {
      gecko: {
        id: 'download-router-companion@pbxg33k.eu' // Required as temp addon ID are not permitted to use storage API
      }
    },
    default_locale: 'en',
  }
});
