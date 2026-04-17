import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import {
  ChevronRightIcon,
  GlobeAltIcon,
  SwatchIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { PWAInstallModal } from "@/components/ui/PWAInstallModal";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const [installModalVariant, setInstallModalVariant] = useState<
    "ios" | "ios-chrome" | "android" | null
  >(null);
  const { isInstalled, platform, installPrompt, promptInstall } = usePWAInstall();

  const isAnonymous = user?.isAnonymous ?? firebaseUser?.isAnonymous ?? false;

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const handleInstallClick = async () => {
    if (installPrompt) {
      // Chrome (Android/Desktop): trigger native install dialog
      await promptInstall();
    } else if (platform === "ios-safari") {
      // iOS Safari: show manual guide (Share → Add to Home Screen)
      setInstallModalVariant("ios");
    } else if (platform === "ios-chrome") {
      // iOS Chrome cannot install PWAs — guide user to open in Safari
      setInstallModalVariant("ios-chrome");
    } else {
      // Android Chrome (engagement heuristic not met) or other:
      // guide user to use the browser's own menu
      setInstallModalVariant("android");
    }
  };

  return (
    <div className="flex h-full min-h-full flex-col px-4 pt-4 pb-8">
      <div className="flex-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("settings.title")}
        </h1>

        <div className="mt-2 flex flex-col">
          {/* Profile Row */}
          <div
            className="flex items-center gap-3 pt-4 pb-4 border-b border-base-200 last:border-b-0 cursor-pointer active:bg-base-300 transition-colors"
            onClick={() => navigate("/settings/profile")}
          >
            <div className="flex items-center gap-3 w-full">
              <UserAvatar
                src={user?.avatarUrl}
                name={user?.displayName ?? "?"}
                size="w-14"
                textSize="text-lg"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg">{user?.displayName}</p>
                <p className="text-xs text-base-content/50">
                  {isAnonymous
                    ? t("settings.guest")
                    : t("settings.googleAccount")}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-base-content/30 shrink-0" />
            </div>
          </div>

          {/* Language Row */}
          <div className="py-4 border-b border-base-200 last:border-b-0">
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center gap-3">
                <GlobeAltIcon className="h-5 w-5 text-base-content/60 shrink-0 mt-0" />
                <h2 className="font-semibold text-sm">
                  {t("settings.language")}
                </h2>
              </div>
              <div className="join w-full">
                <button
                  className={`join-item btn btn-sm btn-pagination-compact flex-1 ${i18n.language === "zh-TW" ? "btn-active text-base-content/85" : "text-base-content/55 hover:text-base-content/65"}`}
                  onClick={() => handleLanguageChange("zh-TW")}
                >
                  繁體中文
                </button>
                <button
                  className={`join-item btn btn-sm btn-pagination-compact flex-1 ${i18n.language === "en" ? "btn-active text-base-content/85" : "text-base-content/55 hover:text-base-content/65"}`}
                  onClick={() => handleLanguageChange("en")}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          {/* Theme Row */}
          <div className="py-4 border-b border-base-200 last:border-b-0">
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-start gap-3">
                <SwatchIcon className="h-5 w-5 text-base-content/60 shrink-0" />
                <h2 className="font-semibold text-sm">{t("settings.theme")}</h2>
              </div>
              <div className="join w-full">
                {(["system", "light", "dark"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`join-item btn btn-sm btn-pagination-compact flex-1 ${themeMode === mode ? "btn-active text-base-content/85" : "text-base-content/55 hover:text-base-content/65"}`}
                    onClick={() => setThemeMode(mode)}
                  >
                    {t(
                      `settings.theme${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Install App Row */}
          <div className="py-4 border-b border-base-200 last:border-b-0">
            <button
              className="flex items-start gap-3 w-full text-left disabled:cursor-default"
              onClick={isInstalled ? undefined : handleInstallClick}
              disabled={isInstalled}
            >
              <ArrowDownTrayIcon className="h-5 w-5 text-base-content/60 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  {t("pwa.install.title")}
                </p>
                <p className="text-xs text-base-content/50 mt-0.5">
                  {isInstalled
                    ? t("pwa.install.installedHint")
                    : t("pwa.install.settingsHint")}
                </p>
              </div>
              {!isInstalled && (
                <ChevronRightIcon className="h-5 w-5 text-base-content/30 shrink-0 mt-2" />
              )}
            </button>
          </div>
        </div>
      </div>

      <PWAInstallModal
        open={installModalVariant !== null}
        variant={installModalVariant ?? "android"}
        onClose={() => setInstallModalVariant(null)}
      />

      {/* Footer Links */}
      <div className="mt-auto pt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 px-4 pb-4">
        <a
          href="https://github.com/ncchen99/Zplit"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-base-content/30 hover:text-primary transition-colors underline underline-offset-4 decoration-base-content/20 hover:decoration-primary/40"
        >
          {t("settings.sourceCode")}
        </a>
        <a
          href="https://github.com/ncchen99/Zplit/blob/main/docs/terms.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-base-content/30 hover:text-primary transition-colors underline underline-offset-4 decoration-base-content/20 hover:decoration-primary/40"
        >
          {t("settings.terms")}
        </a>
        <a
          href="https://github.com/ncchen99/Zplit/blob/main/docs/privacy.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-base-content/30 hover:text-primary transition-colors underline underline-offset-4 decoration-base-content/20 hover:decoration-primary/40"
        >
          {t("settings.privacy")}
        </a>
      </div>
    </div>
  );
}
