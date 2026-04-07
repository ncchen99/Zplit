import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { useUIStore } from '@/store/uiStore';
import { addPlaceholderMember } from '@/services/groupService';
import { logger } from '@/utils/logger';

export function MembersTab() {
  const { t } = useTranslation();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const expenses = useGroupStore((s) => s.expenses);
  const showToast = useUIStore((s) => s.showToast);

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddMember = async () => {
    if (!currentGroup || !newName.trim()) return;
    setAdding(true);
    try {
      await addPlaceholderMember(currentGroup.groupId, newName.trim());
      setNewName('');
      showToast(t('common.button.done'), 'success');
    } catch (err) {
      logger.error('members.add', '新增成員失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setAdding(false);
    }
  };

  // Invite link
  const inviteUrl = `${window.location.origin}/join/${currentGroup?.inviteCode ?? ''}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    showToast(t('group.members.linkCopied'), 'success');
  };

  // Build activity log from expenses' editLog
  const activityLog = expenses
    .flatMap((e) =>
      e.editLog?.map((log) => ({
        ...log,
        expenseTitle: e.title,
      })) ?? []
    )
    .sort((a, b) => {
      const aTime = a.timestamp?.seconds ?? 0;
      const bTime = b.timestamp?.seconds ?? 0;
      return bTime - aTime;
    })
    .slice(0, 20);

  const memberMap = new Map(
    currentGroup?.members?.map((m) => [m.memberId, m.displayName]) ?? []
  );

  return (
    <div>
      {/* Members Section */}
      <h3 className="font-semibold text-sm text-base-content/60 uppercase tracking-wider">
        {t('group.members.members')}
      </h3>

      <div className="mt-3 flex flex-col gap-2">
        {currentGroup?.members?.map((m) => (
          <div key={m.memberId} className="flex items-center gap-3 rounded-lg bg-base-200 p-3">
            <div className="avatar placeholder">
              <div className="w-9 rounded-full bg-neutral text-neutral-content">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" />
                ) : (
                  <span className="text-sm">{m.displayName.charAt(0)}</span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{m.displayName}</p>
              {!m.isBound && (
                <span className="badge badge-ghost badge-xs">{t('group.members.unbound')}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Member */}
      <div className="join mt-4 flex w-full">
        <input
          type="text"
          className="input input-sm join-item flex-1"
          placeholder={t('group.members.memberName')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={30}
        />
        <button
          className="btn btn-primary btn-sm join-item"
          onClick={handleAddMember}
          disabled={!newName.trim() || adding}
        >
          {adding ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            t('group.members.addMember')
          )}
        </button>
      </div>

      {/* Invite Link */}
      <div className="mt-6">
        <h3 className="font-semibold text-sm text-base-content/60 uppercase tracking-wider">
          {t('group.members.invite')}
        </h3>
        <div className="join mt-2 flex w-full">
          <input
            type="text"
            className="input input-sm join-item flex-1 text-xs"
            value={inviteUrl}
            readOnly
          />
          <button className="btn btn-ghost btn-sm join-item" onClick={handleCopyLink}>
            {t('group.members.copyLink')}
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6">
        <h3 className="font-semibold text-sm text-base-content/60 uppercase tracking-wider">
          {t('group.members.activity')}
        </h3>
        {activityLog.length === 0 ? (
          <p className="mt-2 text-sm text-base-content/40">No activity yet</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1">
            {activityLog.map((log, i) => (
              <div key={i} className="text-xs text-base-content/60 py-1">
                <span className="font-semibold">
                  {memberMap.get(log.memberId) ?? log.memberId}
                </span>{' '}
                {log.description}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
