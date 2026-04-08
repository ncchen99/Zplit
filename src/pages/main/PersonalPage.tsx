import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { BanknotesIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { useAuthStore } from '@/store/authStore';
import { usePersonalStore } from '@/store/personalStore';
import {
  getContacts,
  getPersonalExpenses,
  computePersonalNetAmount,
  createContact,
  type PersonalContact,
} from '@/services/personalLedgerService';
import { useUIStore } from '@/store/uiStore';
import { logger } from '@/utils/logger';

interface ContactWithNet extends PersonalContact {
  netAmount: number;
  lastInteraction: Date | null;
}

export function PersonalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const contacts = usePersonalStore((s) => s.contacts);
  const setContacts = usePersonalStore((s) => s.setContacts);
  const isLoading = usePersonalStore((s) => s.isLoadingContacts);
  const setIsLoading = usePersonalStore((s) => s.setIsLoadingContacts);

  const [search, setSearch] = useState('');
  const [showSettled, setShowSettled] = useState(false);
  const [contactsWithNet, setContactsWithNet] = useState<ContactWithNet[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const rawContacts = await getContacts(user.uid);
      setContacts(rawContacts);

      // Compute net amounts for each contact
      const withNet: ContactWithNet[] = await Promise.all(
        rawContacts.map(async (c) => {
          const expenses = await getPersonalExpenses(user.uid, c.contactId);
          const netAmount = computePersonalNetAmount(expenses);
          const lastDate = expenses.length > 0
            ? new Date(
                ((expenses[0].date as { seconds: number })?.seconds ?? 0) * 1000
              )
            : null;
          return { ...c, netAmount, lastInteraction: lastDate };
        })
      );
      setContactsWithNet(withNet);
    } catch (err) {
      logger.error('personal.load', '載入個人記錄失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleAddContact = async () => {
    if (!user || !newContactName.trim()) return;
    setAddingContact(true);
    try {
      const contact = await createContact(user.uid, newContactName.trim());
      setShowAddModal(false);
      setNewContactName('');
      // Navigate to the new contact detail page directly
      navigate(`/personal/${contact.contactId}`);
    } catch (err) {
      logger.error('personal.addContact', '新增聯絡人失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setAddingContact(false);
    }
  };

  const filtered = contactsWithNet.filter((c) =>
    c.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const unsettled = filtered.filter((c) => c.netAmount !== 0);
  const settled = filtered.filter((c) => c.netAmount === 0);

  const totalOwed = unsettled
    .filter((c) => c.netAmount > 0)
    .reduce((sum, c) => sum + c.netAmount, 0);
  const totalOwe = unsettled
    .filter((c) => c.netAmount < 0)
    .reduce((sum, c) => sum + Math.abs(c.netAmount), 0);

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('personal.title')}</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
        >
          <PlusIcon className="h-4 w-4" />
          {t('common.button.add')}
        </button>
      </div>

      {/* Search */}
      <div className="mt-4">
        <label className="input w-full flex items-center gap-2">
          <MagnifyingGlassIcon className="h-4 w-4 text-base-content/40" />
          <input
            type="text"
            className="grow"
            placeholder={t('personal.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {/* Net Summary */}
      {contactsWithNet.length > 0 && (totalOwed > 0 || totalOwe > 0) && (
        <div className="mt-4 flex gap-3">
          <div className="flex-1 rounded-xl bg-success/10 p-3 text-center">
            <p className="text-xs text-success">{t('personal.owedToYouTotal')}</p>
            <p className="text-lg font-bold text-success">NT${totalOwed.toLocaleString()}</p>
          </div>
          <div className="flex-1 rounded-xl bg-warning/10 p-3 text-center">
            <p className="text-xs text-warning">{t('personal.youOweTotal')}</p>
            <p className="text-lg font-bold text-warning">NT${totalOwe.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="mt-12 flex justify-center">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : contactsWithNet.length === 0 ? (
        <div className="mt-12 text-center text-base-content/40">
          <BanknotesIcon className="mx-auto mb-3 h-10 w-10 text-base-content/40" />
          <p>{t('personal.noContacts')}</p>
          <p className="text-sm mt-1">{t('personal.noContactsHint')}</p>
        </div>
      ) : (
        <>
          {/* Unsettled */}
          {unsettled.length > 0 && (
            <div className="mt-4">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                {t('personal.unsettled')}
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {unsettled
                  .sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount))
                  .map((c) => (
                    <ContactCard
                      key={c.contactId}
                      contact={c}
                      onClick={() => navigate(`/personal/${c.contactId}`)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Settled (collapsible) */}
          {settled.length > 0 && (
            <div className="mt-6">
              <button
                className="flex w-full items-center gap-1 text-xs font-semibold text-base-content/50 uppercase tracking-wider"
                onClick={() => setShowSettled(!showSettled)}
              >
                {t('personal.settledSection')}（{settled.length}）
                <ChevronDownIcon
                  className={`h-3 w-3 transition-transform ${showSettled ? 'rotate-180' : ''}`}
                />
              </button>
              {showSettled && (
                <div className="mt-2 flex flex-col gap-2">
                  {settled.map((c) => (
                    <ContactCard
                      key={c.contactId}
                      contact={c}
                      onClick={() => navigate(`/personal/${c.contactId}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold">{t('personal.addExpense')}</h3>
            <div className="mt-4">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder={t('personal.search')}
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddContact();
                  }
                }}
                maxLength={30}
                autoFocus
              />
            </div>

            {/* Show existing contacts that match search */}
            {newContactName.trim() && (
              <div className="mt-3 flex flex-col gap-1">
                {contactsWithNet
                  .filter((c) =>
                    c.displayName.toLowerCase().includes(newContactName.toLowerCase())
                  )
                  .slice(0, 5)
                  .map((c) => (
                    <button
                      key={c.contactId}
                      className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-base-200 active:bg-base-300"
                      onClick={() => {
                        setShowAddModal(false);
                        setNewContactName('');
                        navigate(`/personal/${c.contactId}`);
                      }}
                    >
                      <div className="avatar placeholder">
                        <div className="w-8 rounded-full bg-neutral text-neutral-content">
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt="" />
                          ) : (
                            <span className="text-xs">{c.displayName.charAt(0)}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium">{c.displayName}</span>
                    </button>
                  ))}
                {/* New contact option */}
                {!contactsWithNet.some(
                  (c) => c.displayName.toLowerCase() === newContactName.trim().toLowerCase()
                ) && (
                  <button
                    className="flex items-center gap-2 rounded-lg p-2 text-left text-primary hover:bg-primary/10 active:bg-primary/20"
                    onClick={handleAddContact}
                    disabled={addingContact}
                  >
                    <PlusIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {t('group.create.addAsMember', { name: newContactName.trim() })}
                    </span>
                  </button>
                )}
              </div>
            )}

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowAddModal(false);
                  setNewContactName('');
                }}
              >
                {t('common.button.cancel')}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => { setShowAddModal(false); setNewContactName(''); }}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}

function ContactCard({
  contact,
  onClick,
}: {
  contact: ContactWithNet;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const isOwed = contact.netAmount > 0;
  const isSettled = contact.netAmount === 0;

  return (
    <div
      className="card bg-base-200 cursor-pointer transition-colors active:bg-base-300"
      onClick={onClick}
    >
      <div className="card-body p-3 flex-row items-center gap-3">
        <div className="avatar placeholder">
          <div className="w-10 rounded-full bg-neutral text-neutral-content">
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt="" />
            ) : (
              <span className="text-sm">{contact.displayName.charAt(0)}</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{contact.displayName}</p>
          {contact.lastInteraction && (
            <p className="text-xs text-base-content/40">
              {t('common.lastInteraction', { time: formatRelativeTime(contact.lastInteraction) })}
            </p>
          )}
        </div>
        <div className="text-right">
          {isSettled ? (
            <span className="inline-flex items-center gap-1 text-sm text-base-content/40">
              <CheckCircleIcon className="h-4 w-4" />
              {t('personal.settled')}
            </span>
          ) : isOwed ? (
            <div>
              <p className="text-xs text-success">{t('personal.owedToYouTotal')}</p>
              <p className="font-bold text-success">NT${contact.netAmount.toLocaleString()}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-warning">{t('personal.youOweTotal')}</p>
              <p className="font-bold text-warning">NT${Math.abs(contact.netAmount).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
