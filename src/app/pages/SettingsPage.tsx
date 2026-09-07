import { useUIStore } from '../../store/useUIStore';

export default function SettingsPage() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Settings</h2>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-medium">Appearance</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Switch between light and dark mode.</p>
        </div>
        <button
          onClick={toggleTheme}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium dark:border-slate-700"
        >
          {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        </button>
      </div>
    </div>
  );
}
