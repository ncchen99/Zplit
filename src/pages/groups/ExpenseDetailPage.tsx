import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGroupStore } from '@/store/groupStore';
import { PageHeader, HeaderIconButton } from '@/components/ui/PageHeader';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
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
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
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
            <PencilSquareIcon className="h-6 w-6" />
          </HeaderIconButton>
        )}
      />

      <div className="px-4 pb-16 flex flex-col gap-5">
        {/* Title, Amount, Date */}
        <div className="bg-base-200 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold leading-tight flex items-center gap-2">
              {expense.title}
              {isRepeat && <ArrowPathIcon className="h-4 w-4 text-base-content/50 flex-shrink-0" />}
            </h2>
            <span className="text-2xl font-bold text-warning flex-shrink-0">
              NT${expense.amount.toLocaleString()}
            </span>
          </div>
          {date && (
            <p className="text-sm text-base-content/50 mt-2">{date}</p>
          )}
        </div>

        {/* Payer */}
        <div>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            {t('expense.paidBy')}
          </h3>
          <div className="flex items-center gap-3 bg-base-200 rounded-xl p-3">
            <UserAvatar src={payerAvatar} name={payerName} />
            <span className="font-semibold">{payerName}</span>
          </div>
        </div>

        {/* Split Details */}
        <div>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            {t('expense.splitWith')}
          </h3>
          <div className="bg-base-200 rounded-xl overflow-hidden">
            {expense.splits.map((split, i) => {
              const name = memberMap.get(split.memberId) ?? split.memberId;
              const avatar = memberAvatarMap.get(split.memberId) ?? null;
              return (
                <div
                  key={split.memberId}
                  className={`flex items-center justify-between px-3 py-3 ${
                    i < expense.splits.length - 1 ? 'border-b border-base-300' : ''
                  }`}
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
            <div className="bg-base-200 rounded-xl p-3">
              <p className="text-sm">{expense.description}</p>
            </div>
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
