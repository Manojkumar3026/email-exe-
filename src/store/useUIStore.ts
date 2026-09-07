import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface UIState {
  theme: Theme;
  activeAccountId: string | null;
  selectedSenderKeys: Set<string>;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setActiveAccountId: (id: string | null) => void;
  toggleSenderSelection: (key: string) => void;
  clearSenderSelection: () => void;
}

function applyThemeToDocument(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('icai-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const initialTheme = readStoredTheme();
if (typeof document !== 'undefined') applyThemeToDocument(initialTheme);

export const useUIStore = create<UIState>((set, get) => ({
  theme: initialTheme,
  activeAccountId: null,
  selectedSenderKeys: new Set(),
  setTheme: (theme) => {
    window.localStorage.setItem('icai-theme', theme);
    applyThemeToDocument(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setActiveAccountId: (id) => set({ activeAccountId: id }),
  toggleSenderSelection: (key) =>
    set((state) => {
      const next = new Set(state.selectedSenderKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { selectedSenderKeys: next };
    }),
  clearSenderSelection: () => set({ selectedSenderKeys: new Set() }),
}));
