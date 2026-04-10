import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { deleteGroup } from '@/services/groupService';
import { logger } from '@/utils/logger';
import { LinkIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export function SettingsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isCreator = currentGroup?.createdBy === user?.uid;

  const inviteUrl = `${window.location.origin}/join/${currentGroup?.inviteCode ?? ''}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    showToast(t('group.members.linkCopied'), 'success');
  };

  const handleDeleteGroup = async () => {
    if (!currentGroup) return;
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
      {/* Cover Photo — clickable to edit */}
      {currentGroup?.coverUrl && (
        <div>
          <h3 className="font-semibold text-sm text-base-content/60 uppercase tracking-wider mb-3">
            {t('group.settings.coverPhoto')}
          </h3>
          <button
            className="w-full rounded-xl overflow-hidden focus:outline-none"
            onClick={() => navigate(`/groups/${currentGroup.groupId}/edit`)}
            aria-label={t('group.settings.editGroup')}
          >
            <img
              src={currentGroup.coverUrl}
              alt=""
              className="w-full h-48 object-cover"
            />
          </button>
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
          {t('group.settings.editGroup')}
        </button>
      </div>

      {/* Invite Link */}
      <div>
        <h3 className="font-semibold text-sm text-base-content/60 uppercase tracking-wider mb-3">
          {t('group.settings.inviteLink')}
        </h3>
        <div className="flex items-center gap-3 py-2">
          <LinkIcon className="h-5 w-5 text-base-content/40 shrink-0" />
          <span className="flex-1 text-sm text-base-content/60 truncate">{inviteUrl}</span>
          <button className="btn btn-sm btn-outline shrink-0" onClick={handleCopyLink}>
            {t('group.members.copyLink')}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      {isCreator && (
        <div>
          <h3 className="font-semibold text-sm text-error/70 uppercase tracking-wider mb-3">
            {t('group.settings.dangerZone')}
          </h3>
          <button
            className="btn btn-block btn-error btn-outline gap-2"
            onClick={() => setShowDeleteConfirm(true)}
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
      <ConfirmModal
        open={showDeleteConfirm}
        title={t('group.detail.deleteGroup')}
        message={t('group.detail.deleteConfirm')}
        confirmLabel={t('common.button.delete')}
        cancelLabel={t('common.button.cancel')}
        confirmVariant="btn-error"
        onConfirm={() => { setShowDeleteConfirm(false); handleDeleteGroup(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
