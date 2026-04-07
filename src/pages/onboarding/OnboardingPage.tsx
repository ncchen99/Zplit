import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { createOrUpdateUser } from '@/services/userService';
import { logger } from '@/utils/logger';

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);
  const showToast = useUIStore((s) => s.showToast);

  const [displayName, setDisplayName] = useState(
    firebaseUser?.displayName ?? ''
  );
  const [avatarUrl] = useState<string | null>(firebaseUser?.photoURL ?? null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !displayName.trim()) return;

    setSaving(true);
    try {
      const user = await createOrUpdateUser(firebaseUser.uid, {
        displayName: displayName.trim(),
        avatarUrl,
        isAnonymous: firebaseUser.isAnonymous,
      });
      setUser(user);
      setStatus('ready');
      logger.info('onboarding', '個人資料設定完成', { uid: firebaseUser.uid });
      navigate('/home', { replace: true });
    } catch (err) {
      logger.error('onboarding', '個人資料儲存失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">{t('auth.onboarding.title')}</h1>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-2">
            <div className="avatar placeholder">
              <div className="w-20 rounded-full bg-neutral text-neutral-content">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" />
                ) : (
                  <span className="text-2xl">
                    {displayName.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>
            </div>
            {/* TODO: Avatar upload button (M1-7) */}
          </div>

          {/* Nickname */}
          <fieldset className="fieldset w-full">
            <legend className="fieldset-legend">{t('auth.onboarding.nickname')}</legend>
            <input
              type="text"
              className="input w-full"
              placeholder={t('auth.onboarding.nicknamePlaceholder')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={30}
              required
              autoFocus
            />
          </fieldset>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={!displayName.trim() || saving}
          >
            {saving && <span className="loading loading-spinner loading-sm" />}
            {t('auth.onboarding.continue')}
          </button>
        </form>
      </div>
    </div>
  );
}
