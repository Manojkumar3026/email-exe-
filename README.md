# Inbox Cleaner AI

A Chrome Extension (Manifest V3) for cleaning up large Gmail and Outlook inboxes
(10,000–100,000+ emails): connect accounts, see who's filling up your inbox, and run
bulk cleanup — delete, archive, unsubscribe, block — safely and fast.

No backend server. OAuth, sync, and all data live entirely in the browser
(`chrome.identity`, IndexedDB, `chrome.storage.local`).

## Architecture

```
src/
├── manifest.config.ts        # MV3 manifest (generated via @crxjs/vite-plugin)
├── background/                # Service worker: sync orchestration, bulk job execution, alarms
│   ├── syncOrchestrator.ts    # Chunked, resumable per-account sync
│   ├── bulkJobRunner.ts       # Chunked bulk actions (delete/archive/mark-read/permanent-delete)
│   ├── alarms.ts              # chrome.alarms registration (periodic sync, job crash-recovery)
│   └── messageRouter.ts       # chrome.runtime message dispatch from popup/app
├── popup/                     # Toolbar popup (quick glance, opens the full app)
├── app/                       # Full-page SPA (chrome-extension://…/src/app/index.html)
│   └── pages/                 # Dashboard, Senders, Newsletters, Storage Analyzer,
│                               # Analytics, Accounts, Settings
├── components/                # SenderTable (virtualized), bulk action toolbar, charts, ui/
├── lib/
│   ├── auth/                  # Encrypted token storage, Google (chrome.identity) + Microsoft (PKCE) OAuth
│   ├── gmail/, outlook/       # Provider API clients + adapters implementing lib/providerAdapter.ts
│   ├── db/                    # Dexie/IndexedDB schema + repos (accounts, messages, senders, jobs, history)
│   ├── categorization/        # Pure rule-based email categorization engine
│   ├── cleanup-engine/        # Pure cleanup recommendation engine
│   ├── ai/                    # AIInsightProvider interface + rule-based default implementation
│   └── unsubscribe/           # List-Unsubscribe header parsing
├── store/                     # Zustand: UI state, active job, toasts
├── hooks/                     # React Query hooks wrapping the lib/ layer
└── types/                     # Shared TypeScript domain types
```

**State management boundary:**
- **IndexedDB** (via Dexie) holds the full dataset — messages, sender aggregates, jobs,
  cleanup history. Never loaded wholesale into React state; all views query with indexed
  lookups + pagination, feeding a virtualized (`react-window`) table.
- **React Query** caches reads from IndexedDB/background messaging and drives loading/error
  states.
- **Zustand** holds ephemeral UI state only: active account, filters, table selection, theme,
  active job id, toasts.
- **`chrome.storage.local`** holds only small data: encrypted OAuth tokens, the AES key,
  settings, sync cursors.

See the plan/architecture notes in this repo's commit history for the full design
rationale (provider adapter pattern, MV3 service-worker survivability strategy, etc.).

## Prerequisites

- Node.js 18+ and npm
- Google Chrome (or any Chromium-based browser) for loading the unpacked extension
- A Google Cloud project (for Gmail OAuth) and/or an Azure App Registration (for Outlook OAuth)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Google OAuth client (for Gmail)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. **APIs & Services → Library** → enable the **Gmail API**.
3. **APIs & Services → OAuth consent screen** → configure it (External user type is fine for
   testing; you'll need to add your own Google account as a test user until the app is verified).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, application type
   **Chrome Extension**. For the "Item ID" field, use the extension ID Chrome assigns after you
   load it unpacked once (see step 5 below) — you may need to create the credential, load the
   unpacked extension to learn its ID, then edit the credential's Item ID once you have it, or
   pin an extension `key` (see `docs/DEPLOYMENT.md`) so the ID is stable up front.
5. Copy the generated **Client ID** into `.env.local` as `VITE_GOOGLE_CLIENT_ID`.

### 3. Azure App Registration (for Outlook)

1. Go to [Azure Portal → App registrations → New registration](https://portal.azure.com/).
2. Name it (e.g. "Inbox Cleaner AI"), supported account types: **"Accounts in any
   organizational directory and personal Microsoft accounts"** (or narrower, matching your
   `VITE_MS_TENANT`).
3. **Authentication → Add a platform → Mobile and desktop applications**, and add a **custom
   redirect URI**: `https://<your-extension-id>.chromiumapp.org/` (get the extension ID the
   same way as step 5 above — load unpacked once to learn it, or pin a `key`). Ensure "Allow
   public client flows" is set to **Yes** — this app never uses a client secret.
4. **API permissions** → add delegated Microsoft Graph permissions: `Mail.Read`,
   `Mail.ReadWrite`, `User.Read`, `offline_access`.
5. Copy the **Application (client) ID** into `.env.local` as `VITE_MS_CLIENT_ID`, and set
   `VITE_MS_TENANT` (`common` for both personal + work/school accounts, or your tenant ID to
   restrict to one org).

### 4. Environment file

```bash
cp .env.example .env.local
# then fill in VITE_GOOGLE_CLIENT_ID, VITE_MS_CLIENT_ID, VITE_MS_TENANT
```

### 5. Build and load the extension

```bash
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. **Load unpacked** → select the `dist/` folder.
4. Note the extension ID Chrome assigns — you'll need it for steps 2 and 3 above (Google's
   Item ID, Microsoft's redirect URI). After updating those, rebuild if you changed `.env.local`
   and click the reload icon on the extension card.

### 6. Try it out

- Click the extension icon → **Open Dashboard**.
- Go to **Accounts** → **Connect Gmail** and/or **Connect Outlook**.
- Click **Sync now** on a connected account, then check **Dashboard** / **Senders**.

## Development

```bash
npm run dev          # Vite watch build — reload the unpacked extension in Chrome after each change
npm run typecheck     # tsc --build, no emit
npm run test          # Vitest (unit tests — pure logic, repos against fake-indexeddb, a chrome.* mock)
npm run lint          # ESLint
```

There's no dev server to open in a browser tab the normal Vite way — this is an extension,
so `npm run dev` rebuilds `dist/` on change and you reload the unpacked extension in
`chrome://extensions` (or install the "Extensions Reloader" style workflow of your choice).

## Testing strategy

- **Unit tests** (`tests/unit/`): categorization engine, cleanup recommendation engine, PKCE
  challenge generation (verified against the RFC 7636 test vector), token crypto round-trip,
  Gmail/Outlook message parsing, sender aggregation math, and the bulk job runner's
  chunk/retry/cancel logic — all run against `fake-indexeddb` and a hand-rolled `chrome.*` mock
  in `tests/setup.ts`, no real network or browser needed.
- **Manual verification**: OAuth flows, real API calls, and MV3 service-worker lifecycle
  behavior (survives termination mid-sync/mid-job) need a real Chrome profile and real
  credentials — see the milestone verification notes below.

## Manual verification checklist

1. **Build & load**: `npm run build`, load `dist/` unpacked, popup + dashboard open with no
   console errors, dark/light mode toggle in Settings works and persists on reload.
2. **Gmail connect**: Accounts → Connect Gmail → consent screen → account appears; inspect
   `chrome://extensions` → service worker → Application → IndexedDB/Storage to confirm the
   stored token blob is `{iv, ciphertext}`, not a plaintext token.
3. **Sync**: Sync now on the Gmail account → Dashboard populates with real counts; re-run sync
   and confirm it's incremental (fast, no full re-download) by watching the network panel.
4. **Bulk action**: On Senders, select a low-stakes sender (or a test account with disposable
   mail), Archive or Delete, confirm the modal shows exact counts, watch the progress bar,
   confirm the mail actually moved in Gmail's own UI (Trash, not gone).
5. **Crash recovery**: Start a larger bulk action, then in `chrome://extensions` click the
   service worker's "service worker (Inactive)" link is fine, but to really test kill it via
   the extension's inspect view → close the DevTools window while a job is `running`; wait ~90s
   and confirm (via the Jobs table in IndexedDB, or the UI progress bar resuming) that it
   picks back up rather than staying stuck.
6. **Outlook connect**: Accounts → Connect Outlook → Microsoft consent screen → account
   appears; confirm both `accessToken` and `refreshToken` are stored (check IndexedDB isn't
   used for tokens — only `chrome.storage.local`, key prefix `icai:tokens:`).
7. **Newsletters/unsubscribe**: Newsletters page lists senders with a detected
   List-Unsubscribe header; clicking Unsubscribe opens a new tab to the sender's unsubscribe
   page (never silently submits on your behalf).

## Deployment

See `docs/DEPLOYMENT.md` for packaging and Chrome Web Store submission steps, and
`docs/PRIVACY.md` / `docs/STORE_LISTING.md` for the listing's required privacy policy and
permission justifications.

## Security notes

- **Minimum scopes**: Gmail scopes are `gmail.readonly` + `gmail.modify` + `gmail.labels` (no
  `gmail.send` — the extension never sends email on your behalf, including for unsubscribing:
  it opens the unsubscribe link instead). Outlook scopes are `Mail.Read` + `Mail.ReadWrite` +
  `User.Read` + `offline_access`.
- **Metadata only**: message bodies are never fetched or stored — only headers/metadata
  (sender, subject, date, size estimate, labels, List-Unsubscribe presence).
- **Encrypted tokens**: OAuth tokens are AES-GCM encrypted before being written to
  `chrome.storage.local`; see `src/lib/auth/crypto.ts` for the exact scheme and its documented
  limitations (no OS keystore access from an extension — this protects against casual
  inspection, not a fully compromised machine).
- **No backend**: nothing about your inbox ever leaves your browser to a server this project
  controls — there is no server.
- **Soft delete by default**: bulk "Delete" moves mail to Trash/Deleted Items; permanent
  delete is a separate, more strongly confirmed action.
