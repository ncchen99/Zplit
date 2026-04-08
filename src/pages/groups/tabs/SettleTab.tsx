import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { computeBalances, computeSettlements } from '@/lib/algorithm/settlement';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { ArrowRightIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { UserAvatar } from '@/components/ui/UserAvatar';

export function SettleTab() {
  const { t } = useTranslation();
  const expenses = useGroupStore((s) => s.expenses);
  const settlements = useGroupStore((s) => s.settlements);
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    currentGroup?.members?.forEach((m) => {
      map.set(m.memberId, m.displayName);
    });
    return map;
  }, [currentGroup]);

  const computedDebts = useMemo(() => {
    if (!expenses.length) return [];
    const balances = computeBalances(expenses);
    return computeSettlements(balances);
  }, [expenses]);

  const completedCount = settlements.filter((s) => s.completed).length;
  const totalCount = computedDebts.length || settlements.length;
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
      logger.error('settle.markDone', '標記清算完成失敗', err);
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
      logger.error('settle.undo', '撤銷清算失敗', err);
      showToast(t('common.error'), 'error');
    }
  };

  const handleMarkAllDone = async () => {
    if (!currentGroup || !user) return;
    if (!window.confirm(t('group.settle.markAllDone') + '?')) return;

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
    <div>
      {/* Progress */}
      <div className="mb-4 rounded-xl bg-base-200 p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold">{t('group.settle.progress')}</span>
          <span className="font-bold text-primary">{Math.round(progress)}%</span>
        </div>
        <progress className="progress progress-primary w-full" value={progress} max={100} />
        <p className="text-xs text-base-content/50 mt-1">
          {t('group.settle.progressDetail', {
            completed: completedCount,
            total: totalCount,
          })}
        </p>
      </div>

      {/* Mark All Done */}
      {completedCount < totalCount && (
        <button
          className="btn btn-outline btn-primary btn-sm btn-block mb-4"
          onClick={handleMarkAllDone}
        >
          {t('group.settle.markAllDone')}
        </button>
      )}

      {/* Settlement list */}
      <div className="flex flex-col gap-2">
        {computedDebts.map((debt, i) => {
          const matchingSettlement = settlements.find(
            (s) => s.from === debt.from && s.to === debt.to && s.amount === debt.amount
          );
          const isCompleted = matchingSettlement?.completed ?? false;

          return (
            <div
              key={i}
              className={`-mx-4 px-4 py-3 border-b border-base-200 last:border-b-0 md:mx-0 md:card md:bg-base-200 md:rounded-xl md:px-0 md:py-0 md:mb-2 md:border-0 ${isCompleted ? 'opacity-60' : ''}`}
            >
              <div className="w-full md:card-body md:p-3">
                <div className="flex items-center gap-3">
                  <UserAvatar src={null} name={getName(debt.from)} size="w-9" />

                  <ArrowRightIcon className="h-4 w-4 text-base-content/40" />

                  <UserAvatar src={null} name={getName(debt.to)} size="w-9" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {t('group.settle.transfer', {
                        from: getName(debt.from),
                        to: getName(debt.to),
                      })}
                    </p>
                    <p className="text-lg font-bold text-warning">
                      NT${debt.amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex justify-end">
                  {isCompleted ? (
                    <div className="flex items-center gap-2">
                      <span className="badge badge-success">{t('group.settle.completed')}</span>
                      {matchingSettlement && (
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleUndoComplete(matchingSettlement.settlementId)}
                        >
                          {t('group.settle.undoComplete')}
                        </button>
                      )}
                    </div>
                  ) : matchingSettlement ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleMarkDone(matchingSettlement.settlementId)}
                    >
                      {t('group.settle.markDone')}
                    </button>
                  ) : (
                    <span className="badge badge-ghost text-xs">pending</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
