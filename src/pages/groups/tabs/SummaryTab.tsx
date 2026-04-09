import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import { computeBalances, computeSettlements } from '@/lib/algorithm/settlement';
import { ArrowPathIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { UserAvatar } from '@/components/ui/UserAvatar';

export function SummaryTab() {
  const { t } = useTranslation();
  const expenses = useGroupStore((s) => s.expenses);
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    currentGroup?.members?.forEach((m) => {
      map.set(m.memberId, m.displayName);
    });
    return map;
  }, [currentGroup]);

  const memberAvatarMap = useMemo(() => {
    const map = new Map<string, string | null>();
    currentGroup?.members?.forEach((m) => {
      map.set(m.memberId, m.avatarUrl);
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

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, typeof expenses>();
    expenses.forEach((e) => {
      const dateKey = e.date?.seconds
        ? new Date(e.date.seconds * 1000).toLocaleDateString()
        : 'Unknown';
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(e);
    });
    return groups;
  }, [expenses]);

  return (
    <div>
      {/* Total Spent */}
      {expenses.length > 0 && (
        <div className="flex items-center justify-between -mx-4 px-4 py-3 mb-1 border-b border-base-200">
          <span className="text-sm font-semibold text-base-content/60">
            {t('group.summary.totalSpent')}
          </span>
          <span className="font-bold text-primary text-lg">
            NT${totalSpent.toLocaleString()}
          </span>
        </div>
      )}

      {/* Debt Summary */}
      {debts.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-base-content/40 font-semibold mt-3 mb-1 px-1 uppercase tracking-wider">
            {t('group.settle.title')}
          </p>
          <div className="flex flex-col">
            {debts.map((d, i) => {
              const isUserDebtor = d.from === user?.uid;
              const isUserCreditor = d.to === user?.uid;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between -mx-4 px-4 py-3 border-b border-base-200 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <UserAvatar src={null} name={getName(d.from)} size="w-7" textSize="text-xs" />
                    <ArrowRightIcon className="h-3.5 w-3.5 text-base-content/60" />
                    <UserAvatar src={null} name={getName(d.to)} size="w-7" textSize="text-xs" />
                    <span className="text-sm text-base-content/70">
                      {t('group.summary.owes', {
                        from: getName(d.from),
                        to: getName(d.to),
                      })}
                    </span>
                  </div>
                  <span
                    className={`font-bold ${
                      isUserDebtor
                        ? 'text-warning'
                        : isUserCreditor
                          ? 'text-success'
                          : 'text-base-content'
                    }`}
                  >
                    NT${d.amount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expense List */}
      {expenses.length === 0 ? (
        <div className="mt-16 text-center text-base-content/40">
          <DocumentTextIcon className="mx-auto mb-3 h-12 w-12 text-base-content/40" />
          <p>{t('group.summary.noExpenses')}</p>
          <p className="text-sm mt-1">{t('group.summary.addFirst')}</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {[...groupedByDate.entries()].map(([date, dateExpenses]) => (
            <div key={date}>
              <p className="text-xs text-base-content/40 font-semibold mt-3 mb-1 px-1 uppercase tracking-wider">
                {date}
              </p>
              {dateExpenses.map((expense) => {
                const payer = getName(expense.paidBy);
                const payerAvatar = memberAvatarMap.get(expense.paidBy);
                const splitMembers = expense.splits
                  .map((s) => getName(s.memberId))
                  .filter(Boolean);
                const isRepeat = expense.repeat && expense.repeat.type !== 'none';

                return (
                  <div
                    key={expense.expenseId}
                    className="flex items-center gap-3 -mx-4 px-4 py-3 border-b border-base-200 last:border-b-0"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <UserAvatar src={payerAvatar} name={payer} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="font-semibold truncate">{expense.title}</p>
                          {isRepeat && <ArrowPathIcon className="h-3.5 w-3.5 text-base-content/60" />}
                        </div>
                        <p className="text-xs text-base-content/50">
                          {t('expense.paidFor', { name: payer })}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-warning">
                          NT${expense.amount.toLocaleString()}
                        </p>
                        <div className="avatar-group -space-x-3 mt-1 justify-end">
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
          ))}
        </div>
      )}
    </div>
  );
}
