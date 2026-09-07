import type { ReactNode } from 'react';
import type { Route } from '../router';

const NAV_ITEMS: { route: Route; label: string }[] = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'senders', label: 'Senders' },
  { route: 'newsletters', label: 'Newsletters' },
  { route: 'storage', label: 'Storage Analyzer' },
  { route: 'analytics', label: 'Analytics' },
  { route: 'accounts', label: 'Accounts' },
  { route: 'settings', label: 'Settings' },
];

interface AppShellProps {
  route: Route;
  onNavigate: (route: Route) => void;
  children: ReactNode;
}

export default function AppShell({ route, onNavigate, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-brand-600" />
          <span className="text-sm font-semibold">Inbox Cleaner AI</span>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                route === item.route
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
