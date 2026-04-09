import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { useUIStore } from '@/store/uiStore';
import { LogIn } from 'lucide-react';

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
        <div className="mb-12 flex flex-col items-center">
          <img src="/favicon.svg" alt="Zplit Logo" className="w-24 h-24 mb-4" />
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
              <LogIn className="h-5 w-5" />
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
