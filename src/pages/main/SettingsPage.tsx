import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>

      <div className="mt-6 flex flex-col gap-4">
        {/* Profile */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <h2 className="card-title text-sm">{t('settings.profile')}</h2>
            <div className="flex items-center gap-3 mt-2">
              <div className="avatar placeholder">
                <div className="w-12 rounded-full bg-neutral text-neutral-content">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="avatar" />
                  ) : (
                    <span>{user?.displayName?.charAt(0) ?? '?'}</span>
                  )}
                </div>
              </div>
              <div>
                <p className="font-semibold">{user?.displayName}</p>
                <p className="text-xs text-base-content/50">
                  {user?.isAnonymous ? 'Guest' : 'Google Account'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <h2 className="card-title text-sm">{t('settings.language')}</h2>
            <div className="flex gap-2 mt-2">
              <button
                className={`btn btn-sm ${i18n.language === 'zh-TW' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleLanguageChange('zh-TW')}
              >
                繁體中文
              </button>
              <button
                className={`btn btn-sm ${i18n.language === 'en' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleLanguageChange('en')}
              >
                English
              </button>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <h2 className="card-title text-sm">{t('settings.theme')}</h2>
            <div className="flex gap-2 mt-2">
              {(['system', 'light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  className={`btn btn-sm ${themeMode === mode ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setThemeMode(mode)}
                >
                  {t(`settings.theme${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button className="btn btn-error btn-outline btn-block mt-4" onClick={logout}>
          {t('settings.logout')}
        </button>
      </div>
    </div>
  );
}
