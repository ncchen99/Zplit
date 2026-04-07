import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { createGroup } from '@/services/groupService';
import { logger } from '@/utils/logger';

export function CreateGroupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setSaving(true);
    try {
      const group = await createGroup(
        name.trim(),
        user.uid,
        user.displayName,
        user.avatarUrl
      );
      logger.info('group.create', '群組建立成功', { groupId: group.groupId });
      navigate(`/groups/${group.groupId}`, { replace: true });
    } catch (err) {
      logger.error('group.create', '群組建立失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('group.create.title')}</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('group.create.name')}</legend>
          <input
            type="text"
            className="input w-full"
            placeholder={t('group.create.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            required
            autoFocus
          />
        </fieldset>

        {/* TODO: Cover image upload (M2-3) */}

        <button
          type="submit"
          className="btn btn-primary btn-block mt-4"
          disabled={!name.trim() || saving}
        >
          {saving && <span className="loading loading-spinner loading-sm" />}
          {t('group.create.title')}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => navigate(-1)}
        >
          {t('common.button.cancel')}
        </button>
      </form>
    </div>
  );
}
