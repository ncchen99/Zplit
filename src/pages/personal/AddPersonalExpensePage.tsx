import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import { usePersonalStore } from '@/store/personalStore';
import { useUIStore } from '@/store/uiStore';
import { PageHeader, HeaderIconButton } from '@/components/ui/PageHeader';
import {
  addPersonalExpense,
  getContacts,
  createContact,
  type PersonalContact,
} from '@/services/personalLedgerService';
import { logger } from '@/utils/logger';
import { getTaipeiDateTimeLocalString, parseTaipeiDateTimeLocalString } from '@/utils/datetime';

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
  const [date, setDate] = useState(() => getTaipeiDateTimeLocalString());
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

  // 有 contactId 時，優先用目前聯絡人名稱，否則退回清單中的名稱
  const selectedContactFromStore = contactId
    ? contacts.find((c) => c.contactId === contactId)
    : null;
  const resolvedContactName = contactId
    ? (currentContact?.displayName ?? selectedContactFromStore?.displayName ?? '')
    : (selectedContact?.displayName ?? '');

  const isContactSelected = !!contactId || !!selectedContact;
  const isValid = isContactSelected && title.trim() && amount && Number(amount) > 0;

  const trimmedSearch = contactSearch.trim();
  const filteredContacts = trimmedSearch
    ? contacts.filter((c) =>
        c.displayName.toLowerCase().includes(trimmedSearch.toLowerCase())
      )
    : contacts;
  const showNewContactOption =
    trimmedSearch &&
    !contacts.some(
      (c) => c.displayName.toLowerCase() === trimmedSearch.toLowerCase()
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
        date: parseTaipeiDateTimeLocalString(date),
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
      <PageHeader
        title={t('personal.addExpense')}
        onBack={handleBack}
        rightAction={(
          <HeaderIconButton
            onClick={handleSave}
            disabled={!isValid || saving}
            loading={saving}
            tone="primary"
          >
            <CheckIcon className="h-6 w-6" />
          </HeaderIconButton>
        )}
      />

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
                onBlur={() => setShowContactDropdown(false)}
                autoComplete="off"
              />
              {loadingContacts && (
                <span className="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* 下拉選單 */}
            {showContactDropdown && (filteredContacts.length > 0 || showNewContactOption) && (
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
                      {t('personal.addAsNewContact', { name: trimmedSearch })}
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
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('expense.title')}</legend>
          <input
            type="text"
            className="input w-full"
            placeholder={t('expense.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            autoFocus={!!contactId}
          />
        </fieldset>

        {/* Amount */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('expense.amount')}</legend>
          <div className="input flex items-center gap-2 w-full">
            <span className="text-base-content/50 font-semibold">NT$</span>
            <input
              type="number"
              className="grow"
              placeholder={t('expense.amountPlaceholder')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              inputMode="numeric"
            />
          </div>
        </fieldset>

        {/* Paid By */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('expense.paidBy')}</legend>
          <div className="join w-full">
            <button
              type="button"
              className={`join-item btn btn-sm flex-1 ${paidBy === 'self' ? 'btn-active' : ''}`}
              onClick={() => setPaidBy('self')}
            >
              {resolvedContactName
                ? t('personal.paidFor', { name: resolvedContactName })
                : t('personal.paidForPlaceholder')}
            </button>
            <button
              type="button"
              className={`join-item btn btn-sm flex-1 ${paidBy === 'contact' ? 'btn-active' : ''}`}
              onClick={() => setPaidBy('contact')}
            >
              {resolvedContactName
                ? t('personal.contactPaidByName', { name: resolvedContactName })
                : t('personal.contactPaidPlaceholder')}
            </button>
          </div>
        </fieldset>

        {/* Date */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('expense.date')}</legend>
          <input
            type="datetime-local"
            className="input w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </fieldset>

        {/* Description */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('expense.description')}</legend>
          <textarea
            className="textarea w-full"
            placeholder={t('expense.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </fieldset>
      </div>

    </div>
  );
}
