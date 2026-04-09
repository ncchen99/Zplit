import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import { usePersonalStore } from '@/store/personalStore';
import { useUIStore } from '@/store/uiStore';
import { addPersonalExpense } from '@/services/personalLedgerService';
import { logger } from '@/utils/logger';

export function AddPersonalExpensePage() {
  const { t } = useTranslation();
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const currentContact = usePersonalStore((s) => s.currentContact);
  const showToast = useUIStore((s) => s.showToast);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<'self' | 'contact'>('self');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);

  const contactName = currentContact?.displayName ?? 'Contact';

  const handleSave = async () => {
    if (!user || !contactId || !title.trim() || !amount) return;

    const amountNum = Math.round(Number(amount));
    if (amountNum <= 0 || isNaN(amountNum)) {
      showToast(t('expense.splitValidation.mismatch'), 'error');
      return;
    }

    setSaving(true);
    try {
      await addPersonalExpense(user.uid, contactId, {
        title: title.trim(),
        amount: amountNum,
        paidBy,
        description: description.trim() || null,
        imageUrl: null,
        date: new Date(date),
      });
      showToast(t('common.toast.recordAdded'), 'success');
      navigate(`/personal/${contactId}`);
    } catch (err) {
      logger.error('personal.addExpense', '新增個人帳務失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const isValid = title.trim() && amount && Number(amount) > 0;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          className="-ml-1 p-1 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200 active:bg-base-300 transition-colors"
          onClick={() => navigate(`/personal/${contactId}`)}
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold">{t('personal.addExpense')}</h1>
      </div>

      <div className="flex-1 px-4 mt-4">
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
            autoFocus
          />
        </div>

        {/* Amount */}
        <div className="form-control mt-4">
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
        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text font-medium">{t('expense.paidBy')}</span>
          </label>
          <div className="flex gap-2">
            <button
              className={`btn btn-sm flex-1 ${paidBy === 'self' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPaidBy('self')}
            >
              {t('personal.paidFor', { name: contactName })}
            </button>
            <button
              className={`btn btn-sm flex-1 ${paidBy === 'contact' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPaidBy('contact')}
            >
              {contactName} {t('expense.paidFor', { name: '' }).trim()}
            </button>
          </div>
        </div>

        {/* Date */}
        <div className="form-control mt-4">
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
        <div className="form-control mt-4">
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
