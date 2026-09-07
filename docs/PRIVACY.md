# Privacy Policy — Inbox Cleaner AI

_Last updated: 2026-09-07_

Host this file's content (or a link to it) as the privacy policy URL in the Chrome Web Store
listing and, if applicable, in the Google OAuth consent screen configuration.

## What this extension does

Inbox Cleaner AI helps you find and clean up bulk/unwanted email in your own Gmail and/or
Outlook account. It runs entirely inside your browser — **there is no backend server**, and
the developer of this extension does not operate any service that receives your email data.

## What data we access

With your explicit permission (via Google's or Microsoft's own consent screen), the extension
reads:

- Email **metadata only**: sender name/address, subject line, date received, read/unread
  state, folder/label, an estimated size, and whether a `List-Unsubscribe` header is present.
- **Email bodies are never fetched or stored.**
- Basic account profile info (your email address) to identify which connected account is which.

## Where your data is stored

- All synced metadata is stored **locally on your device**, in the browser's IndexedDB
  storage for this extension. It is never transmitted to any server operated by this
  extension's developer.
- OAuth access/refresh tokens are stored locally in `chrome.storage.local`, encrypted with
  AES-GCM before being written.
- Uninstalling the extension deletes all of this local data (standard Chrome extension
  storage cleanup behavior).

## What actions the extension can take on your behalf

Only when you explicitly trigger them: archiving, moving to trash, permanently deleting, or
marking messages as read; creating a mail filter/rule to route future mail from a blocked
sender to trash. The extension **never sends email** on your behalf (it does not request the
`gmail.send` scope) — "Unsubscribe" opens the sender's unsubscribe link in a new tab for you
to complete, rather than silently submitting anything.

## Third parties

- The extension communicates directly with Google's Gmail API and Microsoft's Graph API,
  under the OAuth consent you grant to each. No other third party receives your data through
  this extension.
- This extension does not use analytics, telemetry, or advertising SDKs.

## Your controls

- Disconnect any account at any time from the Accounts page — this revokes/discards the
  stored tokens for that account and deletes its locally synced data.
- Uninstalling the extension removes all locally stored data.

## Changes to this policy

If this policy changes, the "Last updated" date above will change accordingly, and material
changes will be reflected in the extension's Chrome Web Store listing changelog.

## Contact

_Replace with your support/contact email before publishing._
