import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./lib/i18n";
import "./index.css";
import App from "./App";

// After a deploy, an already-open tab still references the old hashed chunks,
// which no longer exist. Reload once to pick up the new build instead of crashing.
window.addEventListener("vite:preloadError", (event) => {
  const RELOAD_KEY = "zplit.chunkReloadAt";
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 10_000) return; // avoid reload loops when truly offline
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — still attempt a single reload
  }
  event.preventDefault();
  window.location.reload();
});

// 只在正式建置註冊：開發模式下快取模組會讓 HMR 拿到舊程式碼
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed — app still works normally
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
