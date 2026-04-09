import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import { usePersonalStore } from '@/store/personalStore';
import { useUIStore } from '@/store/uiStore';
import {
  addPersonalExpense,
  getContacts,
  createContact,
  type PersonalContact,
} from '@/services/personalLedgerService';
import { logger } from '@/utils/logger';

export function AddPersonalExpensePage() {
  const { t } = useTranslation();
  const { contactId } = useParams<{ contactId?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const currentContact = usePersonalStore((s) => s.currentContact);
  const storeContacts = usePersonalStore((s) => s.contacts);
  const showToast = useUIStore((s) => s.showToast);

  // ── 聯絡人選取狀態（僅在無 contactId 時使用）──
  const [contacts, setContacts] = useState<PersonalContact[]>(storeContacts);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<PersonalContact | null>(null);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // 表單欄位
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<'self' | 'contact'>('self');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  // 若從個人頁 FAB 進入（無 contactId），需載入聯絡人清單
  const loadContacts = useCallback(async () => {
    if (!user || contacts.length > 0) return;
    setLoadingContacts(true);
    try {
      const list = await getContacts(user.uid);
      setContacts(list);
    } catch (err) {
      logger.error('addPersonalExpense.loadContacts', '載入聯絡人失敗', err);
    } finally {
      setLoadingContacts(false);
    }
  }, [user, contacts.length]);

  useEffect(() => {
    if (!contactId) {
      loadContacts();
    }
  }, [contactId, loadContacts]);

  // 有 contactId 時，從 store 取得聯絡人名稱
  const resolvedContactName = contactId
    ? (currentContact?.displayName ?? t('personal.contact'))
    : (selectedContact?.displayName ?? '');

  const isContactSelected = !!contactId || !!selectedContact;
  const isValid = isContactSelected && title.trim() && amount && Number(amount) > 0;

  const filteredContacts = contacts.filter((c) =>
    c.displayName.toLowerCase().includes(contactSearch.toLowerCase())
  );
  const showNewContactOption =
    contactSearch.trim() &&
    !contacts.some(
      (c) => c.displayName.toLowerCase() === contactSearch.trim().toLowerCase()
    );

  const handleSelectContact = (contact: PersonalContact) => {
    setSelectedContact(contact);
    setContactSearch(contact.displayName);
    setShowContactDropdown(false);
  };

  const handleCreateAndSelect = async () => {
    if (!user || !contactSearch.trim()) return;
    setSaving(true);
    try {
      const newContact = await createContact(user.uid, contactSearch.trim());
      setSelectedContact(newContact);
      setContactSearch(newContact.displayName);
      setShowContactDropdown(false);
    } catch (err) {
      logger.error('addPersonalExpense.createContact', '新增聯絡人失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user || !title.trim() || !amount) return;

    const resolvedContactId = contactId ?? selectedContact?.contactId;
    if (!resolvedContactId) return;

    const amountNum = Math.round(Number(amount));
    if (amountNum <= 0 || isNaN(amountNum)) {
      showToast(t('expense.splitValidation.mismatch'), 'error');
      return;
    }

    setSaving(true);
    try {
      await addPersonalExpense(user.uid, resolvedContactId, {
        title: title.trim(),
        amount: amountNum,
        paidBy,
        description: description.trim() || null,
        imageUrl: null,
        date: new Date(date),
      });
      showToast(t('common.toast.recordAdded'), 'success');
      navigate(`/personal/${resolvedContactId}`);
    } catch (err) {
      logger.error('personal.addExpense', '新增個人帳務失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (contactId) {
      navigate(`/personal/${contactId}`);
    } else {
      navigate('/personal');
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          className="-ml-1 p-1 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200 active:bg-base-300 transition-colors"
          onClick={handleBack}
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold">{t('personal.addExpense')}</h1>
      </div>

      <div className="flex-1 px-4 mt-4 flex flex-col gap-4">
        {/* 聯絡人選取（僅在無 contactId 時顯示）*/}
        {!contactId && (
          <div className="form-control relative">
            <label className="label">
              <span className="label-text font-medium">{t('personal.selectContact')}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder={t('personal.contactPlaceholder')}
                value={contactSearch}
                onChange={(e) => {
                  setContactSearch(e.target.value);
                  setSelectedContact(null);
                  setShowContactDropdown(true);
                }}
                onFocus={() => setShowContactDropdown(true)}
                autoComplete="off"
              />
              {loadingContacts && (
                <span className="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* 下拉選單 */}
            {showContactDropdown && contactSearch.trim() && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl bg-base-100 shadow-lg border border-base-200 overflow-hidden">
                {filteredContacts.slice(0, 5).map((c) => (
                  <button
                    key={c.contactId}
                    className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-base-200 active:bg-base-300 transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectContact(c); }}
                  >
                    <div className="avatar placeholder">
                      <div className="w-7 rounded-full bg-neutral text-neutral-content">
                        <span className="text-[10px]">{c.displayName.charAt(0)}</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{c.displayName}</span>
                  </button>
                ))}
                {showNewContactOption && (
                  <button
                    className="flex items-center gap-2 w-full px-4 py-3 text-left text-primary hover:bg-primary/10 active:bg-primary/20 transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); handleCreateAndSelect(); }}
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {t('personal.addAsNewContact', { name: contactSearch.trim() })}
                    </span>
                  </button>
                )}
              </div>
            )}

            {selectedContact && (
              <p className="mt-1 text-xs text-success">{t('personal.contactSelected', { name: selectedContact.displayName })}</p>
            )}
          </div>
        )}

        {/* Title */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">{t('expense.title')}</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder={t('expense.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            autoFocus={!!contactId}
          />
        </div>

        {/* Amount */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">{t('expense.amount')}</span>
          </label>
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="text-base-content/50">NT$</span>
            <input
              type="number"
              className="grow"
              placeholder={t('expense.amountPlaceholder')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              inputMode="numeric"
            />
          </label>
        </div>

        {/* Paid By */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">{t('expense.paidBy')}</span>
          </label>
          <div className="flex gap-2">
            <button
              className={`btn btn-sm flex-1 ${paidBy === 'self' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPaidBy('self')}
            >
              {resolvedContactName
                ? t('personal.paidFor', { name: resolvedContactName })
                : t('personal.paidForPlaceholder')}
            </button>
            <button
              className={`btn btn-sm flex-1 ${paidBy === 'contact' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPaidBy('contact')}
            >
              {resolvedContactName
                ? `${resolvedContactName} ${t('expense.paidFor', { name: '' }).trim()}`
                : t('personal.contactPaidPlaceholder')}
            </button>
          </div>
        </div>

        {/* Date */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">{t('expense.date')}</span>
          </label>
          <input
            type="datetime-local"
            className="input input-bordered w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">{t('expense.description')}</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            placeholder={t('expense.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="px-4 py-4">
        <button
          className="btn btn-primary btn-block"
          disabled={!isValid || saving}
          onClick={handleSave}
        >
          {saving ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            t('common.button.save')
          )}
        </button>
      </div>
    </div>
  );
}
