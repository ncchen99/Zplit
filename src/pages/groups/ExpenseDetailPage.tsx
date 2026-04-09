import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { PageHeader, HeaderIconButton } from '@/components/ui/PageHeader';
import { Pencil as PencilIcon, RotateCw as ArrowPathIcon } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';

export function ExpenseDetailPage() {
  const { t } = useTranslation();
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const expenses = useGroupStore((s) => s.expenses);

  const expense = expenses.find((e) => e.expenseId === expenseId);

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

  if (!expense) {
    return (
      <div className="px-4 pt-4 pb-10 space-y-5">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="skeleton h-6 w-24" />
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
        <div className="skeleton h-28 w-full rounded-2xl" />
        <div className="space-y-3">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-14 w-full rounded-xl" />
        </div>
        <div className="space-y-3">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const payerName = memberMap.get(expense.paidBy) ?? expense.paidBy;
  const payerAvatar = memberAvatarMap.get(expense.paidBy) ?? null;
  const date = expense.date?.seconds
    ? new Date(expense.date.seconds * 1000).toLocaleString()
    : '';
  const isRepeat = expense.repeat && (expense.repeat as { type?: string }).type !== 'none';

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={t('expense.detail.title')}
        onBack={() => navigate(`/groups/${groupId}`)}
        rightAction={(
          <HeaderIconButton onClick={() => navigate(`/groups/${groupId}/expense/${expenseId}/edit`)}>
            <PencilIcon className="h-5 w-5" />
          </HeaderIconButton>
        )}
      />

      <div className="px-4 pb-16 flex flex-col gap-5 mt-4">
        {/* Summary stat */}
        <div className="stats w-full border border-base-300 bg-base-100">
          <div className="stat">
            <div className="stat-title flex items-center gap-2">
              {expense.title}
              {isRepeat && <ArrowPathIcon className="h-4 w-4 text-base-content/50" />}
            </div>
            <div className="stat-value text-warning">
              NT${expense.amount.toLocaleString()}
            </div>
            {date && <div className="stat-desc">{date}</div>}
          </div>
        </div>

        {/* Payer */}
        <div>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            {t('expense.paidBy')}
          </h3>
          <div className="flex items-center gap-3 py-2">
            <UserAvatar src={payerAvatar} name={payerName} />
            <span className="font-semibold">{payerName}</span>
          </div>
        </div>

        {/* Split Details */}
        <div>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            {t('expense.splitWith')}
          </h3>
          <div className="flex flex-col">
            {expense.splits.map((split) => {
              const name = memberMap.get(split.memberId) ?? split.memberId;
              const avatar = memberAvatarMap.get(split.memberId) ?? null;
              return (
                <div
                  key={split.memberId}
                  className="flex items-center justify-between py-3 border-b border-base-200 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar src={avatar} name={name} size="w-8" textSize="text-xs" />
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                  <span className="text-sm font-bold">NT${split.amount.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Description */}
        {expense.description && (
          <div>
            <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
              {t('expense.description')}
            </h3>
            <p className="text-sm">{expense.description}</p>
          </div>
        )}

        {/* Receipt Image */}
        {expense.imageUrl && (
          <div>
            <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
              {t('expense.receipt')}
            </h3>
            <div className="rounded-xl overflow-hidden bg-base-200">
              <img
                src={expense.imageUrl}
                alt="Receipt"
                className="w-full object-contain max-h-96"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
