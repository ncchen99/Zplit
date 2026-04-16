import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt: BeforeInstallPromptEvent | null;
  }
}

function detectStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as { standalone?: boolean }).standalone === true)
  );
}

export type PWAPlatform = "ios-safari" | "ios-chrome" | "android" | "other";

function detectPlatform(): PWAPlatform {
  const ua = navigator.userAgent;

  // Modern iPads in "Request Desktop Website" mode send a Mac UA,
  // so also check navigator.maxTouchPoints as a fallback.
  const isIOS =
    (/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // iOS Safari is the only iOS browser that includes "Version/X.Y" in UA.
    // Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS) all lack it.
    const isIOSSafari =
      /Version\/\d/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    return isIOSSafari ? "ios-safari" : "ios-chrome";
  }

  if (/Android/.test(ua)) return "android";
  return "other";
}

function consumeCachedInstallPrompt(): BeforeInstallPromptEvent | null {
  const prompt = window.__pwaInstallPrompt;
  window.__pwaInstallPrompt = null;
  return prompt;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(() => consumeCachedInstallPrompt());
  const [isInstalled, setIsInstalled] = useState(() => detectStandaloneMode());
  const platform = detectPlatform();

  useEffect(() => {
    const handlePromptReady = () => {
      const cachedPrompt = consumeCachedInstallPrompt();
      if (cachedPrompt) {
        setInstallPrompt(cachedPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("pwa-prompt-ready", handlePromptReady);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("pwa-prompt-ready", handlePromptReady);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
    return outcome === "accepted";
  };

  return { isInstalled, platform, installPrompt, promptInstall };
}
