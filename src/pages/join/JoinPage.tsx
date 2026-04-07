import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import {
  getGroupByInviteCode,
  addMemberToGroup,
  bindMemberToUser,
} from '@/services/groupService';
import type { Group, GroupMember } from '@/store/groupStore';
import { logger } from '@/utils/logger';

export function JoinPage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const showToast = useUIStore((s) => s.showToast);

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) return;
    getGroupByInviteCode(code)
      .then(setGroup)
      .catch((err) => logger.error('join.load', '載入群組失敗', err))
      .finally(() => setLoading(false));
  }, [code]);

  // If not logged in, redirect to login (AuthGuard handles guest → /login)
  // But for /join paths, guest is allowed — they see the page first
  useEffect(() => {
    if (status === 'guest' && !loading && group) {
      navigate(`/login`, { state: { redirectTo: `/join/${code}` } });
    }
  }, [status, loading, group]);

  const handleSelectExisting = async (member: GroupMember) => {
    if (!group || !user) return;
    setJoining(true);
    try {
      await bindMemberToUser(
        group.groupId,
        member.memberId,
        user.uid,
        user.displayName,
        user.avatarUrl
      );
      showToast(t('join.joined'), 'success');
      navigate(`/groups/${group.groupId}`, { replace: true });
    } catch (err) {
      logger.error('join.bind', '綁定成員失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleJoinAsNew = async () => {
    if (!group || !user) return;
    setJoining(true);
    try {
      const member: GroupMember = {
        memberId: user.uid,
        userId: user.uid,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isBound: true,
        joinedAt: null,
      };
      await addMemberToGroup(group.groupId, member);
      showToast(t('join.joined'), 'success');
      navigate(`/groups/${group.groupId}`, { replace: true });
    } catch (err) {
      logger.error('join.new', '加入群組失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-bold text-error">Group not found</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/home')}>
          {t('common.button.back')}
        </button>
      </div>
    );
  }

  const unboundMembers = group.members?.filter((m) => !m.isBound) ?? [];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">{t('join.title')}</h1>
        <p className="mt-1 text-base-content/60">{group.name}</p>

        {unboundMembers.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-base-content/60 mb-3">{t('join.question')}</p>
            <div className="flex flex-col gap-2">
              {unboundMembers.map((m) => (
                <button
                  key={m.memberId}
                  className="btn btn-outline btn-block justify-start"
                  onClick={() => handleSelectExisting(m)}
                  disabled={joining}
                >
                  {m.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn btn-primary btn-block mt-4"
          onClick={handleJoinAsNew}
          disabled={joining}
        >
          {joining && <span className="loading loading-spinner loading-sm" />}
          {t('join.newMember')}
        </button>
      </div>
    </div>
  );
}
