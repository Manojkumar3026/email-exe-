import { defineManifest } from '@crxjs/vite-plugin';
import { loadEnv } from 'vite';
import pkg from '../package.json';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');

export default defineManifest({
  manifest_version: 3,
  name: 'Inbox Cleaner AI',
  version: pkg.version,
  description: 'Clean 10,000-100,000+ email inboxes across Gmail and Outlook.',
  icons: {
    16: 'icons/16.png',
    32: 'icons/32.png',
    48: 'icons/48.png',
    128: 'icons/128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  options_page: 'src/app/index.html',
  permissions: ['identity', 'storage', 'unlimitedStorage', 'alarms', 'notifications'],
  host_permissions: [
    'https://gmail.googleapis.com/*',
    'https://www.googleapis.com/*',
    'https://graph.microsoft.com/*',
    'https://login.microsoftonline.com/*',
  ],
  oauth2: {
    client_id: env.VITE_GOOGLE_CLIENT_ID || '<GOOGLE_OAUTH_CLIENT_ID>.apps.googleusercontent.com',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
    ],
  },
  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'self'; style-src 'self'; connect-src https://gmail.googleapis.com https://www.googleapis.com https://graph.microsoft.com https://login.microsoftonline.com",
  },
});
