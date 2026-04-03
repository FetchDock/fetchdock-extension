# Companion Extension for [FetchDock Server](https://github.com/FetchDock/fetchdock-server)

> **In active development** — features and APIs may change without notice.

Send download jobs to your self-hosted [FetchDock Server](https://github.com/FetchDock/fetchdock-server) server directly from your browser, without leaving the page you're on.

---

## Targeted browsers

| Browser | Status                                                                                                             |
|---------|--------------------------------------------------------------------------------------------------------------------|
| Chrome / Chromium | ✅ [Chrome Web Store](https://chromewebstore.google.com/detail/fetchdock/bfhogjcdmkkidopkodamefcifnjhlogh)          |
| Firefox | ✅ [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/fetchdock/)                                           |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) ≥ 9
- A running [FetchDock Server](https://github.com/FetchDock/fetchdock-server) instance

### Install dependencies

```bash
pnpm install
```

### Development

```bash
# Chrome (default)
pnpm dev

# Firefox
pnpm dev:firefox
```

WXT will open a browser window with the extension loaded automatically.

### Production build

```bash
# Chrome
pnpm build

# Firefox
pnpm build:firefox

# Packaged zip (for store submission)
pnpm zip
pnpm zip:firefox
```

Output is written to `.output/`.

---

## Features

### ⚙️ Settings page
- Configure your PHP FetchDock server host and test the connection
- Toggle optional request metadata sent with each job (cookies, User-Agent, Referrer)
- Light / Dark / System theme support
- Configurable keyboard shortcut for the command palette

### 🔐 OAuth2 Authentication
- Authenticate with your server via a browser popup — no passwords stored
- Tokens are kept in extension storage and refreshed automatically when needed

### 📊 Dashboard
A full-page dashboard for managing your download infrastructure:

| Panel | Description |
|-------|-------------|
| **Downloaders** | All configured downloader backends, their type, enabled state and supported domains |
| **Download Jobs** | All submitted download jobs — click any row to expand a full detail view including the job's event log |
| **Download Events** | Full activity log for any job, searchable by UUID |
---

## Configuration

Open the extension's **Settings** page (click the toolbar popup → *Settings*).

| Setting | Description |
|---------|-------------|
| Server Host | Full URL of your PHP FetchDock instance, e.g. `https://downloader.example.com` |
| Send Cookies | Include browser cookies with each download job |
| Send User-Agent | Include the browser's User-Agent header |
| Send Referrer | Include the page's Referrer header |
| Command Palette Shortcut | Click to record a custom key combination |


---

## Roadmap

- [x] OAuth2 authentication
- [x] Settings page
- [x] Full-page dashboard
- [x] Light / Dark / System theme support
- [x] Add support for [PHP FetchDock](https://github.com/PBXg33k/php-download-router)
- [ ] Send downloads to server from popup / context menu (partially implemented/WIP)
  - [ ] Send (optional) cookies along with a download job
  - [ ] Send (optional) user agent along with a download job
  - [ ] Send (optional) referrer along with a download job
- [ ] Automatically send downloads to server based on rules
- [ ] Add a visual indicator for downloaded pages
- [ ] Add a context menu to send download jobs to the server
- [ ] Track download progress in real time
- [ ] Add notifications for job state changes
- [ ] Download finished files from the server to a local machine
- [ ] Add toggle to disable extension per domain (using [webext-dynamic-content-scripts](https://github.com/fregante/webext-dynamic-content-scripts))
- [ ] Server management (add / remove servers)
- [ ] Fully implement the [PHP FetchDock API](https://github.com/PBXg33k/php-download-router)
  - [x] Downloaders
  - [x] Download Jobs (list, detail, events)
  - [ ] Downloaded files
  - [ ] Supported sites

---

## Contributing

### Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | [WXT](https://wxt.dev) + React 19 |
| UI | Tailwind CSS v4 · shadcn/ui components · Radix UI primitives |
| Messaging | [@webext-core/messaging](https://github.com/aklinker1/webext-core) |
| Settings persistence | [webext-options-sync](https://github.com/fregante/webext-options-sync) |
| API client | Generated TypeScript fetch client (OpenAPI / Swagger) |
| Icons | [Lucide React](https://lucide.dev) |
| i18n | [@wxt-dev/i18n](https://github.com/wxt-dev/i18n) |

### Project structure

```
src/
├── components/
│   ├── CommandPalette.tsx          # Global command palette (cmdk)
│   ├── dashboard/
│   │   ├── navItems.tsx            # Shared nav/panel registry
│   │   ├── ResourcePanel.tsx       # Generic paginated table component
│   │   ├── useResource.ts          # useResource / usePagedResource hooks
│   │   ├── Pagination.tsx          # Pagination footer component
│   │   ├── PageSizeSelect.tsx      # Preset + custom page-size selector
│   │   └── resources/
│   │       ├── DownloadersPanel.tsx
│   │       ├── DownloadJobsPanel.tsx
│   │       ├── DownloadJobDetail.tsx   # Fold-out job detail + events
│   │       └── DownloadJobEventsPanel.tsx
│   └── ui/                         # shadcn/ui + custom primitives
│       ├── badge.tsx · button.tsx · command.tsx · dialog.tsx
│       ├── key-combo-input.tsx     # Record-a-shortcut input
│       ├── state-badge.tsx         # Semantic job-state badge
│       └── theme-toggle.tsx        # Light/Dark/System segmented button
├── entrypoints/
│   ├── background.ts               # Service worker — all browser.* API calls live here
│   ├── popup/                      # Browser toolbar popup
│   ├── options/                    # Settings page
│   ├── dashboard/                  # Full-page dashboard
│   ├── test.content/               # OAuth2 callback interceptor content script
│   └── main.content/               # Page-level content script
├── lib/
│   ├── messaging.ts                # Typed inter-component message protocol
│   ├── tokenManager.ts             # OAuth2 token lifecycle
│   ├── useTheme.ts                 # Theme hook (persisted + OS-synced)
│   ├── fetchUtils.ts               # Fetch helpers
│   └── config.ts · helpers.ts · types.ts · utils.ts
└── service/
    ├── apiService.ts               # Wrapper around the generated API client
    └── api/                        # Generated TypeScript fetch client
```

### Adding a new dashboard panel

The dashboard is built around a registry pattern — adding a new resource panel requires changes in just two places:

1. Create a new panel component in `src/components/dashboard/resources/`
2. Add an entry to `NAV_ITEMS` in `src/components/dashboard/navItems.tsx`

The new panel will automatically appear in the sidebar and the command palette.

---

## License

See [LICENSE](./LICENSE).
