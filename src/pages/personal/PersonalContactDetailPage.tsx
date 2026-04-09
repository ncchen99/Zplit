import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeftIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  TrashIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useAuthStore } from '@/store/authStore';
import { usePersonalStore } from '@/store/personalStore';
import { useUIStore } from '@/store/uiStore';
import {
  getContact,
  getPersonalExpenses,
  computePersonalNetAmount,
  settleAllWithContact,
  deletePersonalExpense,
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

  const netAmount = computePersonalNetAmount(currentExpenses);

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
    loadData();
    return () => clearCurrentContact();
  }, [loadData]);

  const handleSettleAll = async () => {
    if (!user || !contactId || netAmount === 0) return;
    const contactName = currentContact?.displayName ?? '';
    if (!window.confirm(t('personal.settleAllConfirm', { name: contactName }))) return;

    try {
      await settleAllWithContact(user.uid, contactId, netAmount);
      showToast(t('personal.settled'), 'success');
      loadData();
    } catch (err) {
      logger.error('personal.settleAll', '結清失敗', err);
      showToast(t('common.error'), 'error');
    }
    setShowMenu(false);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!user || !contactId) return;
    if (!window.confirm(t('expense.deleteConfirm'))) return;

    try {
      await deletePersonalExpense(user.uid, contactId, expenseId);
      showToast(t('common.button.done'), 'success');
      loadData();
    } catch (err) {
      logger.error('personal.deleteExpense', '刪除帳務失敗', err);
      showToast(t('common.error'), 'error');
    }
  };

  const handleDeleteContact = async () => {
    if (!user || !contactId) return;
    const contactName = currentContact?.displayName ?? '';
    if (!window.confirm(t('personal.deleteContactConfirm', { name: contactName }))) return;

    try {
      await deleteContact(user.uid, contactId);
      showToast(t('common.button.done'), 'success');
      navigate('/personal');
    } catch (err) {
      logger.error('personal.deleteContact', '刪除聯絡人失敗', err);
      showToast(t('common.error'), 'error');
    }
    setShowMenu(false);
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
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const displayName = currentContact?.displayName ?? 'Contact';

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => navigate('/personal')}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="avatar placeholder">
              <div className="w-8 rounded-full bg-neutral text-neutral-content">
                {currentContact?.avatarUrl ? (
                  <img src={currentContact.avatarUrl} alt="" />
                ) : (
                  <span className="text-sm">{displayName.charAt(0)}</span>
                )}
              </div>
            </div>
            {editingName ? (
              <div className="flex items-center gap-1">
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
              </div>
            ) : (
              <h1 className="text-xl font-bold truncate">{displayName}</h1>
            )}
          </div>
        </div>

        <div className="dropdown dropdown-end">
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => setShowMenu(!showMenu)}
          >
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>
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
        </div>
      </div>

      {/* Net Amount Card */}
      <div className="px-4 mt-2">
        <div className="card bg-base-200">
          <div className="card-body p-4 text-center">
            {netAmount === 0 ? (
              <p className="inline-flex items-center justify-center gap-1 text-base-content/50">
                <CheckCircleIcon className="h-4 w-4" />
                {t('personal.settled')}
              </p>
            ) : netAmount > 0 ? (
              <>
                <p className="text-sm text-success">{t('personal.owesYou', { name: displayName })}</p>
                <p className="text-3xl font-bold text-success">
                  NT${netAmount.toLocaleString()}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-warning">{t('personal.youOwe', { name: displayName })}</p>
                <p className="text-3xl font-bold text-warning">
                  NT${Math.abs(netAmount).toLocaleString()}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lending History */}
      <div className="px-4 mt-6 flex-1">
        <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
          {t('personal.lendingHistory')}
        </h2>

        {isLoading ? (
          <div className="mt-6 flex justify-center">
            <span className="loading loading-spinner loading-md" />
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
                onDelete={() => handleDeleteExpense(expense.expenseId)}
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
    </div>
  );
}

function ExpenseCard({
  expense,
  contactName,
  onDelete,
}: {
  expense: PersonalExpense;
  contactName: string;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const isSelfPaid = expense.paidBy === 'self';
  const isSettlement = (expense as Record<string, unknown>).isSettlement === true;
  const dateStr = expense.date
    ? new Date(
        ((expense.date as { seconds: number })?.seconds ?? 0) * 1000
      ).toLocaleDateString()
    : '';

  return (
    <div className="flex items-center gap-3 -mx-4 px-4 py-3 border-b border-base-200 last:border-b-0 md:mx-0 md:card md:bg-base-200 md:rounded-xl md:px-0 md:py-0 md:mb-2 md:border-0">
      <div className="flex items-center gap-3 w-full md:card-body md:p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold truncate">{expense.title}</p>
            {isSettlement && (
              <span className="badge badge-success badge-xs">{t('personal.settledRecord')}</span>
            )}
          </div>
          <p className="text-xs text-base-content/50">
            {isSelfPaid
              ? t('personal.paidFor', { name: contactName })
              : `${contactName} ${t('expense.paidFor', { name: '' }).trim()}`}
            {dateStr && <span className="ml-1 text-base-content/30">{dateStr}</span>}
          </p>
          {expense.description && (
            <p className="text-xs text-base-content/40 mt-0.5 truncate">
              {expense.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-bold ${isSelfPaid ? 'text-success' : 'text-warning'}`}
          >
            {isSelfPaid ? '+' : '-'}NT${expense.amount.toLocaleString()}
          </span>
          {!isSettlement && (
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <TrashIcon className="h-3.5 w-3.5 text-error" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
