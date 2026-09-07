# Chrome Web Store listing notes

## Permission justifications

Chrome Web Store review requires a plain-language justification for every requested
permission/scope. Use these (adapt wording as needed):

| Permission / scope | Justification |
|---|---|
| `identity` | Required to sign the user into their Google and Microsoft accounts via the browser's native OAuth flow, without the extension ever handling passwords. |
| `storage` | Stores account list, encrypted OAuth tokens, user settings, and sync cursors locally in the browser. |
| `unlimitedStorage` | A user's inbox metadata (for 10,000–100,000+ emails) can exceed the default IndexedDB quota; this permission avoids storage-quota failures for large inboxes. |
| `alarms` | Drives periodic background sync and safety-net recovery for interrupted bulk actions — Manifest V3 service workers cannot run persistent timers, so `chrome.alarms` is the required mechanism. |
| `notifications` | Reserved for optional sync/cleanup completion notifications (surfaced today via in-app toasts; the permission is requested for this planned use). |
| `host_permissions`: `gmail.googleapis.com`, `www.googleapis.com` | Required to call the Gmail API (list/get message metadata, label/trash/delete/archive operations) on the user's behalf. |
| `host_permissions`: `graph.microsoft.com`, `login.microsoftonline.com` | Required to call the Microsoft Graph API and the Microsoft identity platform's OAuth token endpoint for Outlook accounts. |
| Gmail scope `gmail.readonly` | Read message metadata to build the sender/category analysis. |
| Gmail scope `gmail.modify` | Perform the user-requested actions: archive, trash, mark read, and create filters (block sender). Does **not** include `gmail.send` — the extension cannot send email. |
| Gmail scope `gmail.labels` | Read/manage Gmail labels used for categorization and the block-sender filter action. |
| Graph scope `Mail.Read` | Read message metadata for Outlook accounts. |
| Graph scope `Mail.ReadWrite` | Perform the user-requested actions: move to Deleted Items/Archive, mark read, delete, create inbox rules (block sender). |
| Graph scope `offline_access` | Required to receive a refresh token so the user isn't forced to re-authenticate every ~60–90 minutes. |
| Graph scope `User.Read` | Read the signed-in user's email address/display name to label the connected account. |

## Gmail API restricted-scope disclosure ("Limited Use")

Because this extension requests `gmail.modify` (classified by Google as a restricted scope),
the listing and OAuth consent screen must comply with Google's [Limited Use
policy](https://developers.google.com/terms/api-services-user-data-policy#limited-use). In
practice:

- Do not use Gmail data for advertising.
- Do not allow humans to read Gmail data except for the narrow exceptions Google's policy
  permits (e.g. debugging with explicit consent).
- Do not transfer Gmail data to any other party (this extension already satisfies this — there
  is no server to transfer data to).
- Complete Google's **OAuth verification** and, since `gmail.modify` is a restricted scope, a
  **CASA (Cloud Application Security Assessment)** — see `docs/DEPLOYMENT.md` for the
  submission-order notes.

## Store listing content checklist

- [ ] Short description (≤132 chars)
- [ ] Detailed description (lead with the core value prop: "clean up 10,000+ emails safely")
- [ ] Category: Productivity
- [ ] At least one 1280×800 or 640×400 screenshot (Dashboard, Senders, and Storage Analyzer
      pages recommended)
- [ ] Small promo tile (440×280) — optional but recommended
- [ ] Privacy policy URL — host `docs/PRIVACY.md`'s content publicly and link it
- [ ] Support email / website
- [ ] Permissions justification text (Privacy practices tab) — copy from the table above
- [ ] Data usage disclosures (Privacy practices tab): declare that the extension handles
      "Personal communications" (email metadata) and that it is **not** sold or used for
      purposes unrelated to the extension's core functionality

## Test accounts (for review + for CASA/OAuth verification)

Google reviewers and Microsoft (if applicable) may need a test account to exercise the OAuth
flow. Keep at least one throwaway Gmail/Outlook test account with a modest amount of synthetic
mail ready, and document login steps for the reviewer in the submission notes field.
