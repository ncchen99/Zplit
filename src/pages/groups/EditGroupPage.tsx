import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useGroupStore } from '@/store/groupStore';
import { useUIStore } from '@/store/uiStore';
import { updateGroup } from '@/services/groupService';
import { logger } from '@/utils/logger';
import { PageHeader, HeaderIconButton } from '@/components/ui/PageHeader';
import { Check as CheckIcon } from 'lucide-react';

export function EditGroupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const showToast = useUIStore((s) => s.showToast);

  const [name, setName] = useState(currentGroup?.name ?? '');
  const [coverUrl, setCoverUrl] = useState(currentGroup?.coverUrl ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentGroup) {
      setName(currentGroup.name);
      setCoverUrl(currentGroup.coverUrl ?? '');
    }
  }, [currentGroup]);

  const hasChanges =
    name !== (currentGroup?.name ?? '') ||
    coverUrl !== (currentGroup?.coverUrl ?? '');

  const handleSave = async () => {
    if (!groupId || !name.trim()) return;
    setSaving(true);
    try {
      await updateGroup(groupId, {
        name: name.trim(),
        coverUrl: coverUrl.trim() || null,
      });
      showToast(t('group.edit.saved'), 'success');
      logger.info('editGroup', '群組資料更新完成');
      navigate(-1);
    } catch (err) {
      logger.error('editGroup', '更新失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={t('group.edit.title')}
        onBack={() => navigate(-1)}
        rightAction={(
          <HeaderIconButton
            onClick={handleSave}
            disabled={!name.trim() || !hasChanges || saving}
            loading={saving}
            tone="primary"
          >
            <CheckIcon className="h-5 w-5" />
          </HeaderIconButton>
        )}
      />

      <div className="flex-1 px-4 pt-6 flex flex-col gap-4">
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('group.edit.name')}</legend>
          <input
            type="text"
            className="input w-full"
            placeholder={t('group.create.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
          />
        </fieldset>

        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('group.edit.coverUrl')}</legend>
          <input
            type="url"
            className="input w-full"
            placeholder="https://..."
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
        </fieldset>

        {coverUrl.trim() && (
          <div className="rounded-xl overflow-hidden">
            <img
              src={coverUrl.trim()}
              alt=""
              className="w-full h-48 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
