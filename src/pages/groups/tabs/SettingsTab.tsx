import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { deleteGroup } from '@/services/groupService';
import { logger } from '@/utils/logger';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

export function SettingsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const [deleting, setDeleting] = useState(false);

  const isCreator = currentGroup?.createdBy === user?.uid;

  const handleDeleteGroup = async () => {
    if (!currentGroup) return;
    if (!window.confirm(t('group.detail.deleteConfirm'))) return;
    setDeleting(true);
    try {
      await deleteGroup(currentGroup.groupId);
      showToast(t('group.settings.groupDeleted'), 'success');
      navigate('/home');
    } catch (err) {
      logger.error('settings.delete', '刪除群組失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cover Photo */}
      {currentGroup?.coverUrl && (
        <div>
          <h3 className="font-semibold text-sm text-base-content/60 uppercase tracking-wider mb-3">
            {t('group.settings.coverPhoto')}
          </h3>
          <div className="rounded-xl overflow-hidden">
            <img
              src={currentGroup.coverUrl}
              alt=""
              className="w-full h-48 object-cover"
            />
          </div>
        </div>
      )}

      {/* Group Info */}
      <div>
        <h3 className="font-semibold text-sm text-base-content/60 uppercase tracking-wider mb-3">
          {t('group.settings.groupInfo')}
        </h3>
        <button
          className="btn btn-block btn-outline gap-2"
          onClick={() => navigate(`/groups/${currentGroup?.groupId}/edit`)}
        >
          <PencilSquareIcon className="h-5 w-5" />
          {t('group.detail.editGroup')}
        </button>
      </div>

      {/* Danger Zone */}
      {isCreator && (
        <div>
          <h3 className="font-semibold text-sm text-error/70 uppercase tracking-wider mb-3">
            {t('group.settings.dangerZone')}
          </h3>
          <button
            className="btn btn-block btn-error btn-outline gap-2"
            onClick={handleDeleteGroup}
            disabled={deleting}
          >
            {deleting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <TrashIcon className="h-5 w-5" />
            )}
            {t('group.detail.deleteGroup')}
          </button>
        </div>
      )}
    </div>
  );
}
