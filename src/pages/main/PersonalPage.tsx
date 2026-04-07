import { useTranslation } from 'react-i18next';

export function PersonalPage() {
  const { t } = useTranslation();

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('personal.title')}</h1>

      <div className="mt-8 text-center text-base-content/40">
        <p>{t('personal.noContacts')}</p>
      </div>
    </div>
  );
}
