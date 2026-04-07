import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { computeBalances, computeSettlements } from '@/lib/algorithm/settlement';

export function SummaryTab() {
  const { t } = useTranslation();
  const expenses = useGroupStore((s) => s.expenses);
  const currentGroup = useGroupStore((s) => s.currentGroup);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    currentGroup?.members?.forEach((m) => {
      map.set(m.memberId, m.displayName);
    });
    return map;
  }, [currentGroup]);

  const debts = useMemo(() => {
    if (!expenses.length) return [];
    const balances = computeBalances(expenses);
    return computeSettlements(balances);
  }, [expenses]);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const getName = (memberId: string) => memberMap.get(memberId) ?? memberId;

  return (
    <div>
      {/* Debt Summary */}
      {debts.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-base-content/60">
              {t('group.summary.totalSpent')}
            </span>
            <span className="font-bold text-primary">NT${totalSpent.toLocaleString()}</span>
          </div>
          <div className="flex flex-col gap-1">
            {debts.map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-base-200 px-3 py-2 text-sm">
                <span>
                  {t('group.summary.owes', {
                    from: getName(d.from),
                    to: getName(d.to),
                  })}
                </span>
                <span className="font-semibold text-warning">NT${d.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense List */}
      {expenses.length === 0 ? (
        <div className="mt-8 text-center text-base-content/40">
          <p>{t('group.summary.noExpenses')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {expenses.map((expense) => {
            const payer = getName(expense.paidBy);
            const splitMembers = expense.splits
              .map((s) => getName(s.memberId))
              .filter(Boolean);

            return (
              <div
                key={expense.expenseId}
                className="card bg-base-200"
              >
                <div className="card-body p-3 flex-row items-center gap-3">
                  {/* Payer avatar */}
                  <div className="avatar placeholder">
                    <div className="w-10 rounded-full bg-neutral text-neutral-content">
                      <span className="text-sm">{payer.charAt(0)}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{expense.title}</p>
                    <p className="text-xs text-base-content/50">
                      {t('expense.paidFor', { name: payer })}
                    </p>
                  </div>

                  {/* Amount & split avatars */}
                  <div className="text-right">
                    <p className="font-bold text-warning">
                      NT${expense.amount.toLocaleString()}
                    </p>
                    <div className="avatar-group -space-x-3 mt-1">
                      {splitMembers.slice(0, 3).map((name, i) => (
                        <div key={i} className="avatar placeholder">
                          <div className="w-5 rounded-full bg-base-300 text-base-content">
                            <span className="text-[10px]">{name.charAt(0)}</span>
                          </div>
                        </div>
                      ))}
                      {splitMembers.length > 3 && (
                        <div className="avatar placeholder">
                          <div className="w-5 rounded-full bg-base-300 text-base-content">
                            <span className="text-[10px]">+{splitMembers.length - 3}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
