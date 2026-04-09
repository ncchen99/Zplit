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
import { ChevronLeftIcon, UserPlusIcon, LinkIcon } from '@heroicons/react/24/outline';
import { ExclamationCircleIcon } from '@heroicons/react/24/solid';

type Step = 'info' | 'select' | 'confirm';

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
  const [step, setStep] = useState<Step>('info');
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!code) return;
    getGroupByInviteCode(code)
      .then(setGroup)
      .catch((err) => logger.error('join.load', '載入群組失敗', err))
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
    }
  }, [user]);

  // If not logged in, redirect to login
  useEffect(() => {
    if (status === 'guest' && !loading && group) {
      navigate(`/login`, { state: { redirectTo: `/join/${code}` } });
    }
  }, [status, loading, group]);

  const handleSelectExisting = (member: GroupMember) => {
    setSelectedMember(member);
    setDisplayName(member.displayName);
    setStep('confirm');
  };

  const handleJoinAsNew = () => {
    setSelectedMember(null);
    setDisplayName(user?.displayName ?? '');
    setStep('confirm');
  };

  const handleConfirmJoin = async () => {
    if (!group || !user) return;
    setJoining(true);
    try {
      if (selectedMember) {
        // Bind to existing placeholder member
        await bindMemberToUser(
          group.groupId,
          selectedMember.memberId,
          user.uid,
          displayName.trim() || user.displayName,
          user.avatarUrl
        );
      } else {
        // Join as new member
        const member: GroupMember = {
          memberId: user.uid,
          userId: user.uid,
          displayName: displayName.trim() || user.displayName,
          avatarUrl: user.avatarUrl,
          isBound: true,
          joinedAt: null,
        };
        await addMemberToGroup(group.groupId, member);
      }
      showToast(t('join.joined'), 'success');
      navigate(`/groups/${group.groupId}`, { replace: true });
    } catch (err) {
      logger.error('join', '加入群組失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex justify-center gap-2">
            <div className="skeleton h-1.5 w-8 rounded-full" />
            <div className="skeleton h-1.5 w-8 rounded-full" />
            <div className="skeleton h-1.5 w-8 rounded-full" />
          </div>
          <div className="skeleton h-4 w-28 mx-auto" />
          <div className="skeleton h-64 w-full rounded-2xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <ExclamationCircleIcon className="mb-4 h-10 w-10 text-warning" />
        <p className="text-lg font-bold text-error">{t('join.invalidLink')}</p>
        <button className="btn btn-primary mt-6" onClick={() => navigate('/home')}>
          {t('join.backToHome')}
        </button>
      </div>
    );
  }

  const unboundMembers = group.members?.filter((m) => !m.isBound) ?? [];
  const boundMembers = group.members?.filter((m) => m.isBound) ?? [];

  return (
    <div className="flex min-h-screen flex-col px-6 pt-4 pb-8">
      {/* Back button (on steps 2 and 3) */}
      {step !== 'info' && (
        <button
          className="btn btn-ghost btn-sm btn-circle self-start mb-4"
          onClick={() => setStep(step === 'confirm' ? 'select' : 'info')}
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      )}

      {/* Step indicator */}
      <div className="flex justify-center gap-2 mb-6">
        {(['info', 'select', 'confirm'] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-1.5 w-8 rounded-full ${
              s === step ? 'bg-primary' : 'bg-base-300'
            }`}
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-sm flex-1">
        {/* Step 1: Group Info */}
        {step === 'info' && (
          <div className="text-center">
            <p className="text-sm text-base-content/50">{t('join.invitedToJoin')}</p>

            {/* Group card */}
            <div className="card bg-base-200 mt-4">
              <div className="card-body items-center text-center p-6">
                {group.coverUrl ? (
                  <img
                    src={group.coverUrl}
                    alt=""
                    className="w-full h-32 rounded-xl object-cover mb-2"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-3xl font-bold text-primary mb-2">
                    {group.name.charAt(0)}
                  </div>
                )}
                <h2 className="text-xl font-bold">{group.name}</h2>
                <p className="text-sm text-base-content/50">
                  {t('common.members_count', { count: group.members?.length ?? 0 })}
                </p>
              </div>
            </div>

            <button
              className="btn btn-primary btn-block btn-lg mt-6"
              onClick={() => setStep('select')}
            >
              {t('join.title')}
            </button>
          </div>
        )}

        {/* Step 2: Select Identity */}
        {step === 'select' && (
          <div>
            <h2 className="text-lg font-bold">{t('join.question')}</h2>
            <p className="text-sm text-base-content/50 mt-1">{t('join.selectMember')}</p>

            {/* Unbound members */}
            {unboundMembers.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {unboundMembers.map((m) => (
                  <button
                    key={m.memberId}
                    className="btn btn-outline btn-block justify-start gap-3"
                    onClick={() => handleSelectExisting(m)}
                    disabled={joining}
                  >
                    <div className="avatar placeholder">
                      <div className="w-8 rounded-full bg-base-300 text-base-content">
                        <span className="text-sm">{m.displayName.charAt(0)}</span>
                      </div>
                    </div>
                    <span className="flex-1 text-left">{m.displayName}</span>
                    <span className="badge badge-ghost badge-sm">{t('join.unboundMember')}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Already bound members (show for reference) */}
            {boundMembers.length > 0 && (
              <div className="mt-3 flex flex-col gap-1">
                {boundMembers.map((m) => (
                  <div
                    key={m.memberId}
                    className="flex items-center gap-3 rounded-xl bg-base-200 px-4 py-2.5 opacity-50"
                  >
                    <div className="avatar placeholder">
                      <div className="w-8 rounded-full bg-neutral text-neutral-content">
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt="" />
                        ) : (
                          <span className="text-sm">{m.displayName.charAt(0)}</span>
                        )}
                      </div>
                    </div>
                    <span className="flex-1">{m.displayName}</span>
                    <span className="badge badge-success badge-sm gap-0.5">
                      <LinkIcon className="h-2.5 w-2.5" />
                      {t('join.boundMember')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Join as new */}
            <div className="divider text-xs text-base-content/30">{t('common.or')}</div>
            <button
              className="btn btn-primary btn-block"
              onClick={handleJoinAsNew}
              disabled={joining}
            >
              <UserPlusIcon className="h-5 w-5" />
              {t('join.newMember')}
            </button>
          </div>
        )}

        {/* Step 3: Confirm Name */}
        {step === 'confirm' && (
          <div>
            <h2 className="text-lg font-bold">{t('join.confirmName')}</h2>
            <p className="text-sm text-base-content/50 mt-1">{t('join.nameHint')}</p>

            <div className="mt-6">
              <label className="text-sm font-medium text-base-content/60 mb-2 block">
                {t('join.displayAs')}
              </label>
              <input
                type="text"
                className="input w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>

            <button
              className="btn btn-primary btn-block btn-lg mt-8"
              onClick={handleConfirmJoin}
              disabled={!displayName.trim() || joining}
            >
              {joining && <span className="skeleton h-4 w-4 rounded-full" />}
              {t('join.confirmJoin')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
