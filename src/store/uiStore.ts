import { create } from "zustand";

type ToastType = "success" | "error" | "info";

interface Toast {
  message: string;
  type: ToastType;
  id: number;
  closing?: boolean;
}

type ThemeMode = "light" | "dark" | "system";

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
    set({ toasts: [...get().toasts, { message, type, id, closing: false }] });
    setTimeout(() => get().removeToast(id), 3000);
  },

  removeToast: (id) => {
    const target = get().toasts.find((t) => t.id === id);
    if (!target || target.closing) return;

    set({
      toasts: get().toasts.map((t) =>
        t.id === id ? { ...t, closing: true } : t,
      ),
    });

    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 220);
  },

  themeMode: (localStorage.getItem("zplit-theme") as ThemeMode) ?? "system",

  setThemeMode: (mode) => {
    localStorage.setItem("zplit-theme", mode);
    set({ themeMode: mode });
  },
}));
