import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  message: string;
  type: ToastType;
  id: number;
}

type ThemeMode = 'light' | 'dark' | 'system';

interface UIStore {
  toasts: Toast[];
  showToast: (message: string, type: ToastType) => void;
  removeToast: (id: number) => void;

  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

let toastId = 0;

export const useUIStore = create<UIStore>((set, get) => ({
  toasts: [],

  showToast: (message, type) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { message, type, id }] });
    setTimeout(() => get().removeToast(id), 3000);
  },

  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  themeMode: (localStorage.getItem('zplit-theme') as ThemeMode) ?? 'system',

  setThemeMode: (mode) => {
    localStorage.setItem('zplit-theme', mode);
    set({ themeMode: mode });
  },
}));
