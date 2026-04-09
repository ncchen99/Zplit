import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EllipsisVertical as EllipsisVerticalIcon,
  Plus as PlusIcon,
  FileText as DocumentTextIcon,
  CircleCheck as CheckCircleIcon,
} from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PageHeader, HeaderIconButton } from '@/components/ui/PageHeader';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuthStore } from '@/store/authStore';
import { usePersonalStore } from '@/store/personalStore';
import { useUIStore } from '@/store/uiStore';
import {
  getContact,
  getPersonalExpenses,
  computePersonalNetAmount,
  settleAllWithContact,
  deleteContact,
  updateContact,
  type PersonalExpense,
} from '@/services/personalLedgerService';
import { logger } from '@/utils/logger';

export function PersonalContactDetailPage() {
  const { t } = useTranslation();
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const currentContact = usePersonalStore((s) => s.currentContact);
  const setCurrentContact = usePersonalStore((s) => s.setCurrentContact);
  const currentExpenses = usePersonalStore((s) => s.currentExpenses);
  const setCurrentExpenses = usePersonalStore((s) => s.setCurrentExpenses);
  const isLoading = usePersonalStore((s) => s.isLoadingExpenses);
  const setIsLoading = usePersonalStore((s) => s.setIsLoadingExpenses);
  const clearCurrentContact = usePersonalStore((s) => s.clearCurrentContact);

  const [showMenu, setShowMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    message: string;
    confirmLabel?: string;
    confirmVariant?: string;
    onConfirm: () => void;
  }>({ open: false, message: '', onConfirm: () => {} });

  const netAmount = computePersonalNetAmount(currentExpenses);
  const loadingDisplayName = currentContact?.displayName ?? '...';

  const loadData = useCallback(async () => {
    if (!user || !contactId) return;
    setIsLoading(true);
    try {
      const [contact, expenses] = await Promise.all([
        getContact(user.uid, contactId),
        getPersonalExpenses(user.uid, contactId),
      ]);
      if (contact) {
        setCurrentContact(contact);
        setEditName(contact.displayName);
      }
      setCurrentExpenses(expenses);
    } catch (err) {
      logger.error('personal.detail.load', '載入個人帳務失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user, contactId]);

  useEffect(() => {
    // 清除前一個聯絡人的舊資料（避免短暫顯示過期內容）
    clearCurrentContact();
    loadData();
    // 不在 unmount 時清除，保留資料供 AddPersonalExpensePage 使用
  }, [loadData]);

  const closeConfirm = () => setConfirmModal((prev) => ({ ...prev, open: false }));

  const handleSettleAll = () => {
    if (!user || !contactId || netAmount === 0) return;
    const contactName = currentContact?.displayName ?? '';
    setConfirmModal({
      open: true,
      message: t('personal.settleAllConfirm', { name: contactName }),
      confirmLabel: t('common.button.confirm'),
      confirmVariant: 'btn-primary',
      onConfirm: async () => {
        closeConfirm();
        try {
          await settleAllWithContact(user.uid, contactId, netAmount);
          showToast(t('personal.settled'), 'success');
          loadData();
        } catch (err) {
          logger.error('personal.settleAll', '結清失敗', err);
          showToast(t('common.error'), 'error');
        }
        setShowMenu(false);
      },
    });
  };

  const handleDeleteContact = () => {
    if (!user || !contactId) return;
    const contactName = currentContact?.displayName ?? '';
    setConfirmModal({
      open: true,
      message: t('personal.deleteContactConfirm', { name: contactName }),
      confirmLabel: t('common.button.delete'),
      confirmVariant: 'btn-error',
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteContact(user.uid, contactId);
          showToast(t('common.button.done'), 'success');
          navigate('/personal');
        } catch (err) {
          logger.error('personal.deleteContact', '刪除聯絡人失敗', err);
          showToast(t('common.error'), 'error');
        }
        setShowMenu(false);
      },
    });
  };

  const handleUpdateName = async () => {
    if (!user || !contactId || !editName.trim()) return;
    try {
      await updateContact(user.uid, contactId, { displayName: editName.trim() });
      setCurrentContact({ ...currentContact!, displayName: editName.trim() });
      setEditingName(false);
      showToast(t('common.button.done'), 'success');
    } catch (err) {
      logger.error('personal.updateName', '更新名稱失敗', err);
      showToast(t('common.error'), 'error');
    }
  };

  if (isLoading && !currentContact) {
    return (
      <div className="flex min-h-screen flex-col">
        <PageHeader
          title={(
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="avatar placeholder shrink-0">
                <span className="w-8 rounded-full bg-neutral text-neutral-content">
                  <span className="text-sm">{loadingDisplayName.charAt(0)}</span>
                </span>
              </span>
              <span className="truncate text-lg font-bold">{loadingDisplayName}</span>
            </span>
          )}
          onBack={() => navigate('/personal')}
          rightAction={(
            <HeaderIconButton onClick={() => {}} disabled>
              <EllipsisVerticalIcon className="h-5 w-5" />
            </HeaderIconButton>
          )}
        />

        <div className="px-4 mt-2">
          <div className="skeleton h-28 w-full rounded-2xl" />
        </div>

        <div className="px-4 mt-6 flex-1">
          <div className="skeleton h-4 w-28" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2">
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-28" />
                </div>
                <div className="skeleton h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayName = currentContact?.displayName ?? 'Contact';

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={(
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="avatar placeholder shrink-0">
              <span className="w-8 rounded-full bg-neutral text-neutral-content">
                {currentContact?.avatarUrl ? (
                  <img src={currentContact.avatarUrl} alt="" />
                ) : (
                  <span className="text-sm">{displayName.charAt(0)}</span>
                )}
              </span>
            </span>
            {editingName ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="text"
                  className="input input-sm input-bordered w-32"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  autoFocus
                  maxLength={30}
                />
                <button className="btn btn-primary btn-xs" onClick={handleUpdateName}>
                  {t('common.button.save')}
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setEditingName(false)}>
                  {t('common.button.cancel')}
                </button>
              </span>
            ) : (
              <span className="truncate text-lg font-bold">{displayName}</span>
            )}
          </span>
        )}
        onBack={() => navigate('/personal')}
        rightAction={(
          <span className="dropdown dropdown-end">
            <HeaderIconButton onClick={() => setShowMenu(!showMenu)}>
              <EllipsisVerticalIcon className="h-5 w-5" />
            </HeaderIconButton>
            {showMenu && (
              <ul className="dropdown-content menu bg-base-200 rounded-box z-50 w-48 p-2 shadow-lg">
                {netAmount !== 0 && (
                  <li>
                    <button onClick={handleSettleAll}>
                      {t('personal.settleAll')}
                    </button>
                  </li>
                )}
                <li>
                  <button onClick={() => { setShowMenu(false); setEditingName(true); }}>
                    {t('personal.editContactName')}
                  </button>
                </li>
                <li>
                  <button className="text-error" onClick={handleDeleteContact}>
                    {t('personal.deleteContact')}
                  </button>
                </li>
              </ul>
            )}
          </span>
        )}
      />

      {/* Net Amount Card */}
      <div className="px-4 mt-4">
        <div className="stats stats-horizontal w-full border border-base-300 bg-base-100">
          <div className="stat py-3 px-4">
            <div className="stat-title text-success">{t('personal.owedToYouTotal')}</div>
            <div className="stat-value text-success text-2xl">
              NT${(netAmount > 0 ? netAmount : 0).toLocaleString()}
            </div>
            <div className="stat-desc truncate">{t('personal.owesYou', { name: displayName })}</div>
          </div>

          <div className="stat py-3 px-4 border-l border-base-300">
            <div className="stat-title text-warning">{t('personal.youOweTotal')}</div>
            <div className="stat-value text-warning text-2xl">
              NT${(netAmount < 0 ? Math.abs(netAmount) : 0).toLocaleString()}
            </div>
            <div className="stat-desc truncate">{t('personal.youOwe', { name: displayName })}</div>
          </div>
        </div>
        {netAmount === 0 && (
          <p className="mt-2 inline-flex items-center justify-center gap-1 text-sm text-base-content/50">
            <CheckCircleIcon className="h-4 w-4" />
            {t('personal.settled')}
          </p>
        )}
      </div>

      {/* Lending History */}
      <div className="px-4 mt-6 flex-1">
        <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
          {t('personal.lendingHistory')}
        </h2>

        {isLoading ? (
          <div className="mt-3 space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2">
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-36" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton h-5 w-14" />
              </div>
            ))}
          </div>
        ) : currentExpenses.length === 0 ? (
          <div className="mt-8 text-center text-base-content/40 py-8">
            <DocumentTextIcon className="mx-auto mb-3 h-12 w-12" />
            <p>{t('personal.noContacts')}</p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col">
            {currentExpenses.map((expense) => (
              <ExpenseCard
                key={expense.expenseId}
                expense={expense}
                contactName={displayName}
                contactAvatarUrl={currentContact?.avatarUrl}
                onClick={() => navigate(`/personal/${contactId}/expenses/${expense.expenseId}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB - Add Expense */}
      <div className="fixed bottom-6 right-4 z-50">
        <button
          className="btn btn-primary btn-circle btn-lg shadow-xl"
          onClick={() => navigate(`/personal/${contactId}/expense/new`)}
          aria-label={t('personal.addExpense')}
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Backdrop */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}

      <ConfirmModal
        open={confirmModal.open}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant={confirmModal.confirmVariant}
        cancelLabel={t('common.button.cancel')}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}

function ExpenseCard({
  expense,
  contactName,
  contactAvatarUrl,
  onClick,
}: {
  expense: PersonalExpense;
  contactName: string;
  contactAvatarUrl?: string | null;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const isSelfPaid = expense.paidBy === 'self';
  const isSettlement = (expense as unknown as Record<string, unknown>).isSettlement === true;
  const dateStr = expense.date
    ? new Date(
        ((expense.date as { seconds: number })?.seconds ?? 0) * 1000
      ).toLocaleDateString()
    : '';
  const user = useAuthStore((s) => s.user);
  const payerName = isSelfPaid ? (user?.displayName ?? '?') : contactName;
  const payerAvatarUrl = isSelfPaid ? (user?.avatarUrl ?? null) : (contactAvatarUrl ?? null);

  return (
    <button
      className="flex items-center gap-3 py-3 border-b border-base-200 last:border-b-0 text-left active:bg-base-200 transition-colors w-full"
      onClick={onClick}
    >
      <UserAvatar
        src={isSelfPaid ? (user?.avatarUrl ?? null) : contactAvatarUrl ?? null}
        name={isSelfPaid ? (user?.displayName ?? '?') : contactName}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold truncate">{expense.title}</p>
          {isSettlement && (
            <span className="badge badge-success badge-xs">{t('personal.settledRecord')}</span>
          )}
        </div>
        <p className="text-xs text-base-content/50">
          {dateStr && <span className="mr-1">{dateStr}</span>}
        </p>
        <p className="text-xs text-base-content/50">
          {isSelfPaid
            ? t('personal.paidFor', { name: contactName })
            : t('personal.contactPaidByName', { name: contactName })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          className={`font-bold ${isSelfPaid ? 'text-success' : 'text-warning'}`}
        >
          {isSelfPaid ? '+' : '-'}NT${expense.amount.toLocaleString()}
        </span>
        <div className="avatar placeholder" title={payerName}>
          <div className="w-6 rounded-full bg-base-300 text-base-content">
            {payerAvatarUrl ? (
              <img src={payerAvatarUrl} alt="" />
            ) : (
              <span className="text-[8px]">{payerName.charAt(0)}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
