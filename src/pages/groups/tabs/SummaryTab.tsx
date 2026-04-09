import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useGroupStore } from '@/store/groupStore';
import { computeBalances } from '@/lib/algorithm/settlement';
import {
  ChevronDownIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { DebtTreemap, type DebtEntry } from '@/components/ui/DebtTreemap';

interface SummaryTabProps {
  onNavigateSettle?: () => void;
}

export function SummaryTab({ onNavigateSettle }: SummaryTabProps) {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const expenses = useGroupStore((s) => s.expenses);
  const currentGroup = useGroupStore((s) => s.currentGroup);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    currentGroup?.members?.forEach((m) => map.set(m.memberId, m.displayName));
    return map;
  }, [currentGroup]);

  const memberAvatarMap = useMemo(() => {
    const map = new Map<string, string | null>();
    currentGroup?.members?.forEach((m) => map.set(m.memberId, m.avatarUrl));
    return map;
  }, [currentGroup]);

  // Build DebtEntry[] for treemap — only negative balances (debtors)
  const treemapData: DebtEntry[] = useMemo(() => {
    if (!expenses.length) return [];
    const balances = computeBalances(expenses);
    return balances
      .filter((b) => b.amount < 0)
      .map((b) => ({
        memberId: b.memberId,
        name: memberMap.get(b.memberId) ?? b.memberId,
        avatarUrl: memberAvatarMap.get(b.memberId) ?? null,
        owed: Math.abs(b.amount),
      }))
      .sort((a, b) => b.owed - a.owed);
  }, [expenses, memberMap, memberAvatarMap]);

  const getName = (memberId: string) => memberMap.get(memberId) ?? memberId;

  return (
    <div className="flex flex-col">
      {/* Top Block: Debt Treemap */}
      {treemapData.length > 0 && (
        <div className="-mx-4 px-4 pb-4 border-b border-base-200 mb-4">
          <DebtTreemap
            data={treemapData}
            formatAmount={(amount) => `-$${amount.toLocaleString()}`}
            onBlockClick={() => onNavigateSettle?.()}
          />
        </div>
      )}

      {/* Bottom Block: Expense Records */}
      {expenses.length === 0 ? (
        <div className="mt-16 text-center text-base-content/40">
          <DocumentTextIcon className="mx-auto mb-3 h-12 w-12" />
          <p>{t('group.summary.noExpenses')}</p>
          <p className="text-sm mt-1">{t('group.summary.addFirst')}</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-base-content/60">
              {t('group.summary.detailRecords')}
            </h3>
            <button className="btn btn-ghost btn-xs gap-1 text-base-content/40">
              {t('group.summary.sortByDate')}
              <ChevronDownIcon className="h-3 w-3" />
            </button>
          </div>

          <div className="flex flex-col">
            {expenses.map((expense) => {
              const payer = getName(expense.paidBy);
              const payerAvatar = memberAvatarMap.get(expense.paidBy) ?? null;
              const isRepeat =
                expense.repeat &&
                (expense.repeat as { type?: string }).type !== 'none';

              return (
                <button
                  key={expense.expenseId}
                  className="flex items-center gap-3 -mx-4 px-4 py-3 border-b border-base-200 last:border-b-0 text-left active:bg-base-200 transition-colors w-[calc(100%+2rem)]"
                  onClick={() =>
                    navigate(`/groups/${groupId}/expenses/${expense.expenseId}`)
                  }
                >
                  <UserAvatar src={payerAvatar} name={payer} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold truncate">{expense.title}</p>
                      {isRepeat && (
                        <ArrowPathIcon className="h-3.5 w-3.5 flex-shrink-0 text-base-content/50" />
                      )}
                    </div>
                    <p className="text-xs text-base-content/50">
                      {t('expense.paidFor', { name: payer })}
                    </p>
                  </div>
                  <span className="font-bold text-warning flex-shrink-0">
                    NT${expense.amount.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
