import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, linkWithPopup, deleteUser } from 'firebase/auth';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import {
  ChevronRightIcon,
  GlobeAltIcon,
  SwatchIcon,
  ArrowRightStartOnRectangleIcon,
  TrashIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { UserAvatar } from '@/components/ui/UserAvatar';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const logout = useAuthStore((s) => s.logout);
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const showToast = useUIStore((s) => s.showToast);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [binding, setBinding] = useState(false);

  const isAnonymous = user?.isAnonymous ?? firebaseUser?.isAnonymous ?? false;

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const handleBindGoogle = async () => {
    if (!firebaseUser) return;
    setBinding(true);
    try {
      const provider = new GoogleAuthProvider();
      await linkWithPopup(firebaseUser, provider);
      showToast(t('settings.bindSuccess'), 'success');
      logger.info('settings', 'Google 帳號綁定成功');
    } catch (err) {
      logger.error('settings.bindGoogle', 'Google 綁定失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setBinding(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;
    try {
      await deleteUser(firebaseUser);
      showToast(t('settings.deleteAccountSuccess'), 'success');
      logger.info('settings', '帳號已刪除');
    } catch (err) {
      logger.error('settings.deleteAccount', '帳號刪除失敗', err);
      showToast(t('common.error'), 'error');
    }
  };

  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>

      <div className="mt-6 flex flex-col">
        {/* Profile Row */}
        <div
          className="flex items-center gap-3 -mx-4 px-4 py-4 border-b border-base-200 last:border-b-0 cursor-pointer active:bg-base-300 transition-colors md:mx-0 md:card md:bg-base-200 md:rounded-xl md:px-0 md:py-0 md:mb-4 md:border-0 md:active:bg-base-300"
          onClick={() => navigate('/settings/profile')}
        >
          <div className="flex items-center gap-3 w-full md:card-body md:p-4">
            <UserAvatar
              src={user?.avatarUrl}
              name={user?.displayName ?? '?'}
              size="w-14"
              textSize="text-lg"
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg">{user?.displayName}</p>
              <p className="text-xs text-base-content/50">
                {isAnonymous ? t('settings.guest') : t('settings.googleAccount')}
              </p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-base-content/30 shrink-0" />
          </div>
        </div>

        {/* Bind Google (anonymous only) */}
        {isAnonymous && (
          <div className="flex items-center gap-3 -mx-4 px-4 py-4 border-b border-base-200 last:border-b-0 md:mx-0 md:card md:bg-base-200 md:rounded-xl md:px-0 md:py-0 md:mb-4 md:border-0">
            <div className="flex items-center gap-3 w-full md:card-body md:p-4">
              <LinkIcon className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">{t('settings.bindGoogle')}</p>
                <p className="text-xs text-base-content/50">{t('settings.bindGoogleHint')}</p>
              </div>
              <button
                className="btn btn-primary btn-sm shrink-0"
                onClick={handleBindGoogle}
                disabled={binding}
              >
                {binding && <span className="loading loading-spinner loading-xs" />}
                {t('settings.bindGoogle')}
              </button>
            </div>
          </div>
        )}

        {/* Language Row */}
        <div className="-mx-4 px-4 py-4 border-b border-base-200 last:border-b-0 md:mx-0 md:card md:bg-base-200 md:rounded-xl md:px-0 md:py-0 md:mb-4 md:border-0">
          <div className="flex flex-col gap-3 w-full md:card-body md:p-4">
            <div className="flex items-center gap-3">
              <GlobeAltIcon className="h-5 w-5 text-base-content/60" />
              <h2 className="font-semibold text-sm">{t('settings.language')}</h2>
            </div>
            <div className="flex gap-2">
              <button
                className={`btn btn-sm flex-1 ${i18n.language === 'zh-TW' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleLanguageChange('zh-TW')}
              >
                繁體中文
              </button>
              <button
                className={`btn btn-sm flex-1 ${i18n.language === 'en' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleLanguageChange('en')}
              >
                English
              </button>
            </div>
          </div>
        </div>

        {/* Theme Row */}
        <div className="-mx-4 px-4 py-4 border-b border-base-200 last:border-b-0 md:mx-0 md:card md:bg-base-200 md:rounded-xl md:px-0 md:py-0 md:mb-4 md:border-0">
          <div className="flex flex-col gap-3 w-full md:card-body md:p-4">
            <div className="flex items-center gap-3">
              <SwatchIcon className="h-5 w-5 text-base-content/60" />
              <h2 className="font-semibold text-sm">{t('settings.theme')}</h2>
            </div>
            <div className="flex gap-2">
              {(['system', 'light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  className={`btn btn-sm flex-1 ${themeMode === mode ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setThemeMode(mode)}
                >
                  {t(`settings.theme${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            className="btn btn-outline btn-block"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
            {t('settings.logout')}
          </button>

          <button
            className="btn btn-error btn-outline btn-block"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <TrashIcon className="h-5 w-5" />
            {t('settings.deleteAccount')}
          </button>
        </div>
      </div>

      {/* Logout Confirm Dialog */}
      {showLogoutConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="font-semibold">{t('settings.logoutConfirm')}</p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)}>
                {t('common.button.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleLogout}>
                {t('settings.logout')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowLogoutConfirm(false)} />
        </div>
      )}

      {/* Delete Account Confirm Dialog */}
      {showDeleteConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-error">{t('settings.deleteAccount')}</h3>
            <p className="mt-2 text-sm">{t('settings.deleteAccountWarning')}</p>
            <div className="mt-4">
              <p className="text-sm text-base-content/60 mb-2">{t('settings.deleteAccountConfirm')}</p>
              <input
                type="text"
                className="input w-full"
                placeholder={t('settings.deleteAccountPlaceholder')}
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteText('');
                }}
              >
                {t('common.button.cancel')}
              </button>
              <button
                className="btn btn-error"
                disabled={deleteText !== '刪除' && deleteText !== 'DELETE'}
                onClick={handleDeleteAccount}
              >
                {t('settings.deleteAccount')}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteText('');
            }}
          />
        </div>
      )}
    </div>
  );
}
