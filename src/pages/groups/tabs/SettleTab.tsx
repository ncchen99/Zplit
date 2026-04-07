import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { computeBalances, computeSettlements } from '@/lib/algorithm/settlement';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';

export function SettleTab() {
  const { t } = useTranslation();
  const expenses = useGroupStore((s) => s.expenses);
  const settlements = useGroupStore((s) => s.settlements);
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);

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
    }
  };

  if (computedDebts.length === 0 && settlements.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-2xl">🎉</p>
        <p className="mt-2 font-semibold">{t('group.settle.noDebts')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-base-content/60">{t('group.settle.progress')}</span>
          <span className="font-semibold">{Math.round(progress)}%</span>
        </div>
        <progress className="progress progress-primary w-full" value={progress} max={100} />
      </div>

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
              className={`card bg-base-200 ${isCompleted ? 'opacity-50' : ''}`}
            >
              <div className="card-body p-3 flex-row items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {t('group.settle.transfer', {
                      from: getName(debt.from),
                      to: getName(debt.to),
                    })}
                  </p>
                  <p className="text-lg font-bold text-warning">
                    NT${debt.amount.toLocaleString()}
                  </p>
                </div>
                {isCompleted ? (
                  <span className="badge badge-success">{t('group.settle.completed')}</span>
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
          );
        })}
      </div>
    </div>
  );
}
