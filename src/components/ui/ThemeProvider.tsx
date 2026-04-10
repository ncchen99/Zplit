import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useUIStore((s) => s.themeMode);

  useEffect(() => {
    const applyTheme = (mode: "light" | "dark" | "system") => {
      let theme: string;
      if (mode === "system") {
        theme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dim"
          : "lemonade";
      } else {
        theme = mode === "dark" ? "dim" : "lemonade";
      }
      document.documentElement.setAttribute("data-theme", theme);
    };

    applyTheme(themeMode);

    if (themeMode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [themeMode]);

  return <>{children}</>;
}
