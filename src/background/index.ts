// Service worker entry point. Registers alarm handlers and the message router.
// Kept intentionally thin — actual sync/job logic lands in milestones 2-5.

console.log('[inbox-cleaner-ai] background service worker started');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[inbox-cleaner-ai] installed');
  }
});
