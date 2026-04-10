import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { computeBalances, computeSettlements } from '@/lib/algorithm/settlement';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { ArrowRight as ArrowRightIcon, Sparkles as SparklesIcon, Check as CheckIcon } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export function SettleTab() {
  const { t } = useTranslation();
  const expenses = useGroupStore((s) => s.expenses);
  const settlements = useGroupStore((s) => s.settlements);
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    currentGroup?.members?.forEach((m) => {
      map.set(m.memberId, m.displayName);
    });
    return map;
  }, [currentGroup]);

  const memberAvatarMap = useMemo(() => {
    const map = new Map<string, string | null>();
    currentGroup?.members?.forEach((m) => map.set(m.memberId, m.avatarUrl));
    return map;
  }, [currentGroup]);

  const computedDebts = useMemo(() => {
    if (!expenses.length) return [];
    const balances = computeBalances(expenses);
    return computeSettlements(balances);
  }, [expenses]);

  const completedCount = settlements.filter((s) => s.completed).length;
  const totalCount = computedDebts.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 100;

  const getName = (memberId: string) => memberMap.get(memberId) ?? memberId;

  const handleMarkDone = async (settlementId: string) => {
    if (!currentGroup || !user) return;
    try {
      const ref = doc(db, `groups/${currentGroup.groupId}/settlements/${settlementId}`);
      await updateDoc(ref, {
        completed: true,
        completedBy: user.uid,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      logger.error('settle.markDone', '標記結算完成失敗', err);
      showToast(t('common.error'), 'error');
    }
  };

  const handleUndoComplete = async (settlementId: string) => {
    if (!currentGroup || !user) return;
    try {
      const ref = doc(db, `groups/${currentGroup.groupId}/settlements/${settlementId}`);
      await updateDoc(ref, {
        completed: false,
        completedBy: null,
        completedAt: null,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      logger.error('settle.undo', '撤銷結算失敗', err);
      showToast(t('common.error'), 'error');
    }
  };

  const handleMarkAllDone = async () => {
    if (!currentGroup || !user) return;
    try {
      const pending = settlements.filter((s) => !s.completed);
      for (const s of pending) {
        const ref = doc(db, `groups/${currentGroup.groupId}/settlements/${s.settlementId}`);
        await updateDoc(ref, {
          completed: true,
          completedBy: user.uid,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      showToast(t('common.button.done'), 'success');
    } catch (err) {
      logger.error('settle.markAllDone', '全部標記完成失敗', err);
      showToast(t('common.error'), 'error');
    }
  };

  if (computedDebts.length === 0 && settlements.length === 0) {
    return (
      <div className="mt-16 text-center text-base-content/40">
        <SparklesIcon className="mx-auto mb-3 h-12 w-12" />
        <p className="mt-2 font-semibold">{t('group.settle.noDebts')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Card */}
      <div className="stats stats-horizontal w-full flex border border-base-300 bg-base-100">
        <div className="stat py-3.5 px-4 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-base-content/70 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              {t('group.settle.progress')}
            </h3>
            <span className="text-sm font-black text-primary px-2 py-0.5 rounded-full">
              {Math.round(progress)}%
            </span>
          </div>

          <progress
            className="progress progress-primary w-full h-2.5"
            value={progress}
            max={100}
          />

          <div className="flex justify-between items-center mt-3">
            <span className="text-xs font-medium text-base-content/50">
              {t('group.settle.progressDetail', {
                completed: completedCount,
                total: totalCount,
              })}
            </span>
            {completedCount < totalCount && (
              <button
                className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 px-2"
                onClick={() => setShowMarkAllConfirm(true)}
              >
                {t('group.settle.markAllDone')}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showMarkAllConfirm}
        message={t('group.settle.markAllDone') + '?'}
        confirmLabel={t('common.button.confirm')}
        cancelLabel={t('common.button.cancel')}
        onConfirm={() => {
          setShowMarkAllConfirm(false);
          handleMarkAllDone();
        }}
        onCancel={() => setShowMarkAllConfirm(false)}
      />

      {/* Settlement list */}
      <div className="space-y-3">
        {computedDebts.map((debt, i) => {
          const matchingSettlement = settlements.find(
            (s) => s.from === debt.from && s.to === debt.to && s.amount === debt.amount
          );
          const isCompleted = matchingSettlement?.completed ?? false;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 py-3 border-b border-base-200 last:border-b-0 ${isCompleted ? 'opacity-50' : ''}`}
            >
              <UserAvatar src={memberAvatarMap.get(debt.from) ?? null} name={getName(debt.from)} size="w-9" />
              <ArrowRightIcon className="h-4 w-4 text-base-content/40 flex-shrink-0" />
              <UserAvatar src={memberAvatarMap.get(debt.to) ?? null} name={getName(debt.to)} size="w-9" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {t('group.settle.transfer', {
                    from: getName(debt.from),
                    to: getName(debt.to),
                  })}
                </p>
                <p className="text-base font-bold text-warning">
                  NT${debt.amount.toLocaleString()}
                </p>
              </div>

              <div className="flex-shrink-0">
                {isCompleted ? (
                  <button
                    className="btn btn-ghost btn-sm btn-circle text-success"
                    onClick={() => matchingSettlement && handleUndoComplete(matchingSettlement.settlementId)}
                    title={t('group.settle.undoComplete')}
                  >
                    <CheckIcon className="h-5 w-5" />
                  </button>
                ) : matchingSettlement ? (
                  <button
                    className="btn-theme-green btn-sm btn-circle"
                    onClick={() => handleMarkDone(matchingSettlement.settlementId)}
                    title={t('group.settle.markDone')}
                  >
                    <CheckIcon className="h-5 w-5" />
                  </button>
                ) : (
                  <span className="badge badge-ghost badge-sm">pending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
