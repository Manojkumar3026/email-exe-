function openDashboard() {
  chrome.runtime.openOptionsPage();
}

export default function Popup() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-brand-600" />
        <div>
          <h1 className="text-sm font-semibold leading-tight">Inbox Cleaner AI</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Clean up large inboxes fast</p>
        </div>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-300">
          Connect a Gmail or Outlook account to see your inbox stats here.
        </p>
      </div>

      <button
        onClick={openDashboard}
        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        Open Dashboard
      </button>
    </div>
  );
}
