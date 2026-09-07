# Deployment guide

## Pinning a stable extension ID

Both Google's OAuth client (Item ID) and Microsoft's redirect URI depend on the extension ID
being stable. Chrome derives the ID from the extension's public key, so:

1. Generate a key pair once:
   ```bash
   openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
   openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
   ```
2. Add the base64 public key output as a top-level `"key"` field in `src/manifest.config.ts`'s
   manifest object (or in a small override applied only for local/dev builds — do not publish
   this key in a public repo if you're using it for a private key pair beyond local dev; the
   Chrome Web Store assigns its own permanent ID on first upload regardless of this key).
3. Rebuild and reload unpacked — the extension ID in `chrome://extensions` is now stable across
   reloads, matching whatever you registered with Google/Azure.

**Production note**: once you upload to the Chrome Web Store, the Store assigns the extension
its permanent public ID. Update the Google OAuth client's Item ID and the Azure redirect URI to
that final published ID before/at release, and keep a separate "dev" OAuth client/app
registration pointed at your local unpacked ID for development so you're not juggling one
credential across environments.

## Building for release

```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run zip     # produces dist-zip/inbox-cleaner-ai-<version>.zip
```

`vite.config.ts` + `@crxjs/vite-plugin` produce a fully MV3-compliant `dist/` — compiled
Tailwind CSS (no CDN), no inline scripts, CSP-compliant service worker as an ES module.

## Chrome Web Store submission

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) →
   pay the one-time developer registration fee if you haven't already → **New Item** → upload
   `dist-zip/inbox-cleaner-ai-<version>.zip`.
2. Fill in the listing: name, description, category (Productivity), screenshots (at least one
   1280×800 or 640×400 screenshot of the Dashboard and Senders pages), and the small promo
   tile.
3. **Privacy practices tab**: this is where Chrome Web Store review checks permission
   justifications — see `docs/STORE_LISTING.md` for the exact copy to use for each requested
   permission/scope, and link to a hosted version of `docs/PRIVACY.md` as your privacy policy
   URL (host it as a GitHub Pages page, a Gist raw link, or any static page you control).
4. **Gmail API scope verification**: because this app requests `gmail.modify` (a "restricted
   scope"), Google requires a **CASA security assessment** and **OAuth verification** before
   the app can be used by anyone other than the up-to-100 test users you added on the OAuth
   consent screen. Budget real time for this — it's a Google process, not a Chrome Web Store
   one, and typically takes days to weeks. Until verified, the app works fine for you and any
   test users you've explicitly added.
5. Submit for review. Chrome Web Store review for a new item is typically a few business days;
   updates to an already-approved item are usually faster unless permissions changed.

## Environment / secrets

- `.env.local` is gitignored and never committed — `VITE_GOOGLE_CLIENT_ID` /
  `VITE_MS_CLIENT_ID` /`VITE_MS_TENANT` are baked into the built JS at build time (they're
  public client identifiers, not secrets — this is safe and standard for public-client OAuth
  apps with no client secret).
- There is no server, so there are no server secrets to manage.

## Post-release maintenance

- Bump `version` in `package.json` (it flows into the manifest via
  `src/manifest.config.ts`).
- Re-run the full build/test/zip pipeline above and upload the new zip as an update in the
  Developer Dashboard.
- If you change requested OAuth scopes or permissions, Chrome Web Store re-review (and
  potentially a new Google OAuth verification pass) is required.
