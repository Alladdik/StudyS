/**
 * useDarkMode — shared state via zustand so all consumers (Layout, ProfilePage, etc.)
 * stay in sync when the toggle is clicked from anywhere.
 */
import { create } from 'zustand';

const KEY = 'ltropik-dark';

function getInitial(): boolean {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored !== null) return stored === 'true';
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  try { localStorage.setItem(KEY, String(dark)); } catch {}
}

interface ThemeStore {
  dark: boolean;
  toggle: () => void;
  set: (v: boolean) => void;
}

const useThemeStore = create<ThemeStore>((set, get) => ({
  dark: (() => {
    const v = getInitial();
    applyDark(v);
    return v;
  })(),
  toggle: () => {
    const next = !get().dark;
    applyDark(next);
    set({ dark: next });
  },
  set: (v: boolean) => {
    applyDark(v);
    set({ dark: v });
  },
}));

export function useDarkMode() {
  return useThemeStore();
}
