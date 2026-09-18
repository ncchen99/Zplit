import { useTranslation } from "react-i18next";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInAnonymously,
  type AuthError,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { logger } from "@/utils/logger";
import { useUIStore } from "@/store/uiStore";
import {
  buildExternalBrowserUrl,
  detectInAppBrowser,
} from "@/utils/browser";

// 只有匿名登入需要人機驗證，按下按鈕才下載 Turnstile 元件與 Cloudflare 腳本
const Turnstile = lazy(() =>
  import("@marsidev/react-turnstile").then((m) => ({ default: m.Turnstile })),
);

// Popup 無法使用的環境（PWA 獨立視窗、App 內建瀏覽器、行動瀏覽器阻擋彈窗），
// 改用 redirect 流程重試，否則使用者會完全無法用 Google 登入
const POPUP_FALLBACK_CODES = [
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
];

// 使用者自行關閉彈窗或連點，不算錯誤
const POPUP_CANCEL_CODES = [
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
];

function getAuthErrorCode(err: unknown): string {
  return (err as AuthError | undefined)?.code ?? "";
}

export function LoginPage() {
  const { t } = useTranslation();
  const showToast = useUIStore((s) => s.showToast);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [loading, setLoading] = useState(false);
  const inAppBrowser = useMemo(() => detectInAppBrowser(), []);

  // redirect 流程回到本頁時，補抓登入結果與錯誤（成功時由 onAuthStateChanged 接手導頁）
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) logger.info("auth.login", "Google 登入成功（redirect）");
      })
      .catch((err) => {
        logger.error("auth.login", "Google redirect 登入失敗", err);
        showToast(t("common.errorDetail.googleLoginFailed"), "error");
      });
  }, [showToast, t]);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    setShowTurnstile(false);
  }, []);

  const verifyTurnstile = async (token: string): Promise<boolean> => {
    const workerUrl = import.meta.env.VITE_TURNSTILE_WORKER_URL;
    if (!workerUrl) {
      logger.error("auth.login", "Turnstile Worker URL 未設定");
      showToast("Turnstile Worker URL 未設定", "error");
      return false;
    }

    const res = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    return res.ok;
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      logger.info("auth.login", "Google 登入成功");
    } catch (err) {
      const code = getAuthErrorCode(err);

      // Google 會以 disallowed_useragent 擋下 App 內建瀏覽器，使用者關掉那頁錯誤
      // 訊息後我們只會收到 popup-closed-by-user，因此一律導向外部瀏覽器的說明。
      // 這裡也擋掉下面的 redirect fallback：redirect 只會讓整頁變成同一則錯誤。
      if (inAppBrowser.app) {
        logger.warn("auth.login", "App 內建瀏覽器無法使用 Google 登入", {
          app: inAppBrowser.app,
          code,
        });
        showToast(t("auth.login.inAppBrowser.hint"), "error");
        return;
      }

      if (POPUP_CANCEL_CODES.includes(code)) {
        logger.info("auth.login", "使用者取消 Google 登入", { code });
        return;
      }

      if (POPUP_FALLBACK_CODES.includes(code)) {
        logger.warn("auth.login", "Popup 不可用，改用 redirect 流程", { code });
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch (redirectErr) {
          logger.error("auth.login", "Google redirect 登入失敗", redirectErr);
        }
      } else {
        logger.error("auth.login", "Google 登入失敗", err);
      }

      showToast(t("common.errorDetail.googleLoginFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExternally = async () => {
    if (inAppBrowser.canOpenExternally) {
      window.location.href = buildExternalBrowserUrl();
      return;
    }

    // 其餘 App 沒有公開的跳出參數，只能讓使用者自己貼到瀏覽器
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast(t("auth.login.inAppBrowser.linkCopied"), "success");
    } catch (err) {
      logger.warn("auth.login", "複製連結失敗", err);
      showToast(t("common.error"), "error");
    }
  };

  const handleAnonymousLogin = async (tokenFromTurnstile?: string) => {
    const token = tokenFromTurnstile ?? turnstileToken;

    if (!token) {
      setShowTurnstile(true);
      return;
    }

    setLoading(true);
    try {
      const verified = await verifyTurnstile(token);
      if (!verified) {
        showToast(t("common.errorDetail.invalidTurnstile"), "error");
        setTurnstileToken(null);
        setShowTurnstile(true);
        return;
      }

      await signInAnonymously(auth);
      logger.info("auth.login", "匿名登入成功");
      setTurnstileToken(null);
      setShowTurnstile(false);
    } catch (err) {
      logger.error("auth.login", "匿名登入失敗", err);
      showToast(t("common.errorDetail.anonymousLoginFailed"), "error");
      setTurnstileToken(null);
      setShowTurnstile(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] md:min-h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {/* Logo & Tagline - upper area */}
        <div className="mb-12 flex flex-col items-center">
          <img src="/favicon.svg" alt="Zplit Logo" className="w-24 h-24 mb-4" />
          <h1 className="text-5xl font-extrabold tracking-tight text-brand">
            Zplit
          </h1>
          <p className="mt-3 text-lg text-base-content/60">
            {t("auth.login.tagline")}
          </p>
        </div>

        {/* App 內建瀏覽器（LINE 等）無法使用 Google 登入，事先引導使用者 */}
        {inAppBrowser.app && (
          <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-left">
            <p className="text-sm font-semibold text-base-content/80">
              {t("auth.login.inAppBrowser.title")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-base-content/60">
              {t("auth.login.inAppBrowser.description")}
            </p>
            <button
              className="btn btn-sm btn-warning btn-block mt-3"
              onClick={() => void handleOpenExternally()}
            >
              {inAppBrowser.canOpenExternally
                ? t("auth.login.inAppBrowser.openExternal")
                : t("auth.login.inAppBrowser.copyLink")}
            </button>
          </div>
        )}

        {/* Login Buttons */}
        <div className="flex flex-col gap-3">
          <button
            className="btn-theme-green btn-block"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {t("auth.login.googleLogin")}
          </button>

          <div className="divider text-xs text-base-content/40">
            {t("common.or")}
          </div>

          {!showTurnstile ? (
            <>
              <button
                className="btn-muted btn-block"
                onClick={() => void handleAnonymousLogin()}
                disabled={loading}
              >
                {t("auth.login.anonymousLogin")}
              </button>

              <p className="text-xs text-base-content/40">
                {t("auth.login.anonymousHint")}
              </p>
            </>
          ) : (
            <div className="w-full overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex h-[65px] items-center justify-center">
                    <span className="loading loading-spinner loading-md text-primary" />
                  </div>
                }
              >
                <Turnstile
                  className="w-full"
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  onSuccess={async (token) => {
                    setTurnstileToken(token);
                    await handleAnonymousLogin(token);
                  }}
                  onError={(errorCode) => {
                    logger.warn("auth.login", "Turnstile challenge 錯誤", {
                      errorCode,
                    });
                    showToast(t("common.errorDetail.invalidTurnstile"), "error");
                    // 還原按鈕，否則畫面只剩空白的驗證區塊、使用者無法再登入
                    resetTurnstile();
                  }}
                  onExpire={() => {
                    logger.warn("auth.login", "Turnstile token 過期");
                    resetTurnstile();
                  }}
                  onUnsupported={() => {
                    logger.error("auth.login", "瀏覽器不支援 Turnstile");
                    showToast(
                      t("common.errorDetail.turnstileUnsupported"),
                      "error",
                    );
                    resetTurnstile();
                  }}
                  options={{ theme: "auto", size: "flexible" }}
                />
              </Suspense>
            </div>
          )}
        </div>

        {/* Terms & Privacy */}
        <p className="mt-8 text-xs text-base-content/30">
          {t("auth.login.termsNotice")}{" "}
          <a className="link link-hover">{t("auth.login.termsLink")}</a>
          {" & "}
          <a className="link link-hover">{t("auth.login.privacyLink")}</a>
        </p>
      </div>
    </div>
  );
}
