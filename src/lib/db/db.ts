import { createDB } from './schema';

// Single shared Dexie instance. Safe to import from both the background service worker
// and the app/popup contexts — each gets its own connection to the same on-disk IndexedDB.
export const db = createDB();
