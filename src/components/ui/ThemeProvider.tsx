import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

const THEME_COLORS = {
  light: "#f8fdef", // lemonade base-100
  dark: "#2a303c", // dim base-100
} as const;

function updateThemeColorMeta(isDark: boolean) {
  const color = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  const existing = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
  if (existing?.content === color) return;
  // Replace the tag rather than editing it: some Android browsers / installed
  // PWAs only pick up theme-color when the element itself changes.
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.querySelectorAll("meta[name='theme-color']").forEach((el) => el.remove());
  document.head.appendChild(meta);
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
