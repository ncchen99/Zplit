import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { useUIStore } from '@/store/uiStore';

export function LoginPage() {
  const { t } = useTranslation();
  const showToast = useUIStore((s) => s.showToast);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [loading, setLoading] = useState(false);

  const verifyTurnstile = async (token: string): Promise<boolean> => {
    const workerUrl = import.meta.env.VITE_TURNSTILE_WORKER_URL;
    if (!workerUrl) {
      logger.error('auth.login', 'Turnstile Worker URL 未設定');
      showToast('Turnstile Worker URL 未設定', 'error');
      return false;
    }

    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    return res.ok;
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      logger.info('auth.login', 'Google 登入成功');
    } catch (err) {
      logger.error('auth.login', 'Google 登入失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    if (!turnstileToken) {
      setShowTurnstile(true);
      return;
    }

    setLoading(true);
    try {
      const verified = await verifyTurnstile(turnstileToken);
      if (!verified) {
        showToast('人機驗證失敗，請再試一次', 'error');
        setTurnstileToken(null);
        setShowTurnstile(true);
        return;
      }

      await signInAnonymously(auth);
      logger.info('auth.login', '匿名登入成功');
      setTurnstileToken(null);
      setShowTurnstile(false);
    } catch (err) {
      logger.error('auth.login', '匿名登入失敗', err);
      showToast(t('common.error'), 'error');
      setTurnstileToken(null);
      setShowTurnstile(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {/* Logo & Tagline - upper area */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold tracking-tight text-primary">Zplit</h1>
          <p className="mt-3 text-lg text-base-content/60">{t('auth.login.tagline')}</p>
        </div>

        {/* Login Buttons */}
        <div className="flex flex-col gap-3">
          <button
            className="btn btn-primary btn-block btn-lg"
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
            {t('auth.login.googleLogin')}
          </button>

          <div className="divider text-xs text-base-content/40">{t('common.or')}</div>

          <button
            className="btn btn-outline btn-block"
            onClick={handleAnonymousLogin}
            disabled={loading}
          >
            {t('auth.login.anonymousLogin')}
          </button>

          <p className="text-xs text-base-content/40">{t('auth.login.anonymousHint')}</p>

          {showTurnstile && (
            <div className="rounded-box border border-base-300 p-3">
              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                onSuccess={async (token) => {
                  setTurnstileToken(token);
                  setShowTurnstile(false);
                  await handleAnonymousLogin();
                }}
                onError={() => {
                  logger.error('auth.login', 'Turnstile 元件載入失敗');
                  showToast('驗證元件載入失敗', 'error');
                }}
                options={{ theme: 'auto' }}
              />
            </div>
          )}
        </div>

        {/* Terms & Privacy */}
        <p className="mt-8 text-xs text-base-content/30">
          {t('auth.login.termsNotice')}{' '}
          <a className="link link-hover">{t('auth.login.termsLink')}</a>
          {' & '}
          <a className="link link-hover">{t('auth.login.privacyLink')}</a>
        </p>
      </div>
    </div>
  );
}
