import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { usePersonalStore } from '@/store/personalStore';
import { useUIStore } from '@/store/uiStore';
import { PageHeader, HeaderIconButton } from '@/components/ui/PageHeader';
import { Pencil as PencilIcon } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  getContact,
  getPersonalExpenses,
  type PersonalExpense,
  type PersonalContact,
} from '@/services/personalLedgerService';
import { logger } from '@/utils/logger';

export function PersonalExpenseDetailPage() {
  const { t } = useTranslation();
  const { contactId, expenseId } = useParams<{ contactId: string; expenseId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const storeContact = usePersonalStore((s) => s.currentContact);
  const storeExpenses = usePersonalStore((s) => s.currentExpenses);

  const [contact, setContact] = useState<PersonalContact | null>(storeContact);
  const [expense, setExpense] = useState<PersonalExpense | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user || !contactId || !expenseId) return;
    setLoading(true);
    try {
      // Try store first
      let resolvedContact = storeContact;
      let resolvedExpenses = storeExpenses;

      if (!resolvedContact || resolvedContact.contactId !== contactId) {
        resolvedContact = await getContact(user.uid, contactId);
      }
      if (!resolvedExpenses.length || resolvedExpenses[0]?.expenseId === undefined) {
        resolvedExpenses = await getPersonalExpenses(user.uid, contactId);
      }

      setContact(resolvedContact);
      const found = resolvedExpenses.find((e) => e.expenseId === expenseId) ?? null;
      setExpense(found);
    } catch (err) {
      logger.error('personalExpenseDetail.load', 'Failed to load', err);
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [user, contactId, expenseId, storeContact, storeExpenses]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !expense) {
    return (
      <div className="flex min-h-screen flex-col">
        <PageHeader
          title={t('expense.detail.title')}
          onBack={() => navigate(`/personal/${contactId}`)}
          rightAction={(
            <HeaderIconButton onClick={() => {}} disabled>
              <PencilIcon className="h-5 w-5" />
            </HeaderIconButton>
          )}
        />

        <div className="px-4 pb-16 flex flex-col gap-5 mt-4">
          {/* Summary stat skeleton */}
          <div className="stats w-full border border-base-300 bg-base-100">
            <div className="stat">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-10 w-40 mt-2" />
              <div className="skeleton h-3 w-32 mt-2" />
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

          {/* Split skeleton */}
          <div>
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="flex items-center gap-3 py-2 border-b border-base-200">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="skeleton h-4 w-24 flex-1" />
              <div className="skeleton h-4 w-20" />
            </div>
            <div className="flex items-center gap-3 py-2">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="skeleton h-4 w-24 flex-1" />
              <div className="skeleton h-4 w-20" />
            </div>
          </div>

          {/* Description skeleton */}
          <div>
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="space-y-2">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-5/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const contactName = contact?.displayName ?? 'Contact';
  const isSelfPaid = expense.paidBy === 'self';
  const date = expense.date
    ? new Date(((expense.date as { seconds: number })?.seconds ?? 0) * 1000).toLocaleString()
    : '';

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={t('expense.detail.title')}
        onBack={() => navigate(`/personal/${contactId}`)}
        rightAction={(
          <HeaderIconButton onClick={() => navigate(`/personal/${contactId}/expenses/${expenseId}/edit`)}>
            <PencilIcon className="h-5 w-5" />
          </HeaderIconButton>
        )}
      />

      <div className="px-4 pb-16 flex flex-col gap-5 mt-4">
        {/* Summary stat */}
        <div className="stats w-full border border-base-300 bg-base-100">
          <div className="stat">
            <div className="stat-title">{expense.title}</div>
            <div className={`stat-value ${isSelfPaid ? 'text-success' : 'text-warning'}`}>
              {isSelfPaid ? '+' : '-'}NT${expense.amount.toLocaleString()}
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
            <UserAvatar
              src={isSelfPaid ? (user?.avatarUrl ?? null) : (contact?.avatarUrl ?? null)}
              name={isSelfPaid ? (user?.displayName ?? '?') : contactName}
            />
            <span className="font-semibold">
              {isSelfPaid ? (user?.displayName ?? '?') : contactName}
            </span>
          </div>
        </div>

        {/* Split */}
        <div>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            {t('expense.splitWith')}
          </h3>
          <div className="flex items-center gap-3 py-2 border-b border-base-200">
            <UserAvatar src={user?.avatarUrl ?? null} name={user?.displayName ?? '?'} size="w-8" textSize="text-xs" />
            <span className="text-sm font-medium flex-1">{user?.displayName ?? '?'}</span>
            <span className="text-sm font-bold">NT${expense.amount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <UserAvatar src={contact?.avatarUrl ?? null} name={contactName} size="w-8" textSize="text-xs" />
            <span className="text-sm font-medium flex-1">{contactName}</span>
            <span className="text-sm font-bold">NT${expense.amount.toLocaleString()}</span>
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
      </div>
    </div>
  );
}
