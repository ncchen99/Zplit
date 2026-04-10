import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGroupStore, type Expense, type Group } from '@/store/groupStore';
import { PageHeader, HeaderIconButton } from '@/components/ui/PageHeader';
import { Pencil as PencilIcon, RotateCw as ArrowPathIcon } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';

export function ExpenseDetailPage() {
  const { t } = useTranslation();
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();

  const storeGroup = useGroupStore((s) => s.currentGroup);
  const storeExpenses = useGroupStore((s) => s.expenses);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);
  const setExpenses = useGroupStore((s) => s.setExpenses);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;

    let groupLoaded = false;
    let expensesLoaded = false;
    const tryFinish = () => {
      if (groupLoaded && expensesLoaded) setLoading(false);
    };

    const groupUnsub = onSnapshot(
      doc(db, 'groups', groupId),
      (snap) => {
        if (snap.exists()) {
          setCurrentGroup({ groupId: snap.id, ...snap.data() } as Group);
        }
        groupLoaded = true;
        tryFinish();
      }
    );

    const expensesUnsub = onSnapshot(
      query(collection(db, `groups/${groupId}/expenses`), orderBy('date', 'desc')),
      (snap) => {
        const expenses = snap.docs.map((d) => ({ ...d.data(), expenseId: d.id })) as Expense[];
        setExpenses(expenses);
        expensesLoaded = true;
        tryFinish();
      }
    );

    return () => {
      groupUnsub();
      expensesUnsub();
    };
  }, [groupId]);

  const currentGroup = storeGroup?.groupId === groupId ? storeGroup : null;
  const expense = storeExpenses.find((e) => e.expenseId === expenseId);

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

  const header = (
    <PageHeader
      title={t('expense.detail.title')}
      onBack={() => navigate(`/groups/${groupId}`)}
      rightAction={expense ? (
        <HeaderIconButton onClick={() => navigate(`/groups/${groupId}/expense/${expenseId}/edit`)}>
          <PencilIcon className="h-5 w-5" />
        </HeaderIconButton>
      ) : (
        <HeaderIconButton onClick={() => {}} disabled>
          <PencilIcon className="h-5 w-5" />
        </HeaderIconButton>
      )}
    />
  );

  if (loading || !expense) {
    return (
      <div className="flex min-h-screen flex-col">
        {header}

        <div className="px-4 pb-16 flex flex-col gap-5 mt-4">
          {/* Summary stat skeleton */}
          <div className="stats w-full border border-base-300 bg-base-100">
            <div className="stat">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-10 w-32 mt-2" />
              <div className="skeleton h-3 w-36 mt-2" />
            </div>
          </div>

          {/* Payer skeleton */}
          <div>
            <div className="skeleton h-3 w-16 mb-2" />
            <div className="flex items-center gap-3 py-2">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="skeleton h-5 w-28" />
            </div>
          </div>

          {/* Split details skeleton */}
          <div>
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="flex flex-col">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 border-b border-base-200 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="skeleton h-8 w-8 rounded-full" />
                    <div className="skeleton h-4 w-24" />
                  </div>
                  <div className="skeleton h-4 w-16" />
                </div>
              ))}
            </div>
          </div>

          {/* Description and receipt placeholders */}
          <div>
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="space-y-2">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-4/5" />
            </div>
          </div>

          <div>
            <div className="skeleton h-3 w-16 mb-2" />
            <div className="skeleton h-40 w-full rounded-xl" />
          </div>
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
      {header}

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
