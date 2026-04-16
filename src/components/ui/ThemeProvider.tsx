import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

const THEME_COLORS = {
  light: "#f9fef5", // lemonade base-100
  dark: "#272f3d",  // dim base-100
} as const;

function updateThemeColorMeta(isDark: boolean) {
  const color = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  // Update all theme-color meta tags (there may be media-specific ones)
  document.querySelectorAll<HTMLMetaElement>("meta[name='theme-color']").forEach((el) => {
    el.content = color;
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useUIStore((s) => s.themeMode);

  useEffect(() => {
    const applyTheme = (mode: "light" | "dark" | "system") => {
      const isDark =
        mode === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
          : mode === "dark";

      const theme = isDark ? "dim" : "lemonade";
      document.documentElement.setAttribute("data-theme", theme);
      updateThemeColorMeta(isDark);
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
