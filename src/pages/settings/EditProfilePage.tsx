import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { createOrUpdateUser } from '@/services/userService';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { logger } from '@/utils/logger';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

export function EditProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const setUser = useAuthStore((s) => s.setUser);
  const showToast = useUIStore((s) => s.showToast);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);

  const hasChanges =
    displayName !== (user?.displayName ?? '') ||
    avatarUrl !== (user?.avatarUrl ?? null);

  const handleSave = async () => {
    if (!firebaseUser || !displayName.trim()) return;

    setSaving(true);
    try {
      const updated = await createOrUpdateUser(firebaseUser.uid, {
        displayName: displayName.trim(),
        avatarUrl,
        isAnonymous: firebaseUser.isAnonymous,
      });
      setUser(updated);
      showToast(t('common.button.done'), 'success');
      logger.info('editProfile', '個人資料更新完成');
      navigate(-1);
    } catch (err) {
      logger.error('editProfile', '更新失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button className="btn btn-ghost btn-sm btn-circle" onClick={() => navigate(-1)}>
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">{t('settings.editProfileTitle')}</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={!displayName.trim() || !hasChanges || saving}
        >
          {saving && <span className="loading loading-spinner loading-xs" />}
          {t('common.button.save')}
        </button>
      </div>

      <div className="flex-1 px-4 pt-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <ImageUpload
            currentUrl={avatarUrl}
            onUpload={setAvatarUrl}
            onRemove={() => setAvatarUrl(null)}
            shape="circle"
          />
          <p className="text-xs text-base-content/40">{t('settings.changeAvatar')}</p>
        </div>

        {/* Nickname */}
        <fieldset className="fieldset w-full mt-8">
          <legend className="fieldset-legend">{t('auth.onboarding.nickname')}</legend>
          <input
            type="text"
            className="input w-full"
            placeholder={t('auth.onboarding.nicknamePlaceholder')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={20}
          />
          <p className="mt-1 text-xs text-base-content/40 text-right">
            {displayName.length}/20
          </p>
        </fieldset>
      </div>
    </div>
  );
}
