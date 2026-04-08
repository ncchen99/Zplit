import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useGroupStore } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { addExpense } from '@/services/expenseService';
import { recalculateSettlements } from '@/services/settlementService';
import { logger } from '@/utils/logger';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

type SplitMode = 'equal' | 'amount' | 'percent';
type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';

export function AddExpensePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(user?.uid ?? '');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    currentGroup?.members?.map((m) => m.memberId) ?? []
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercents, setCustomPercents] = useState<Record<string, string>>({});
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [saving, setSaving] = useState(false);

  const members = currentGroup?.members ?? [];
  const amountNum = parseInt(amount) || 0;

  // Calculate splits based on mode
  const splits = useMemo(() => {
    if (!amountNum || selectedMembers.length === 0) return [];

    switch (splitMode) {
      case 'equal': {
        const perPerson = Math.floor(amountNum / selectedMembers.length);
        const remainder = amountNum - perPerson * selectedMembers.length;
        return selectedMembers.map((memberId, i) => ({
          memberId,
          amount: perPerson + (i < remainder ? 1 : 0),
        }));
      }
      case 'amount':
        return selectedMembers.map((memberId) => ({
          memberId,
          amount: parseInt(customAmounts[memberId] ?? '0') || 0,
        }));
      case 'percent':
        return selectedMembers.map((memberId) => {
          const pct = parseFloat(customPercents[memberId] ?? '0') || 0;
          return {
            memberId,
            amount: Math.round((amountNum * pct) / 100),
          };
        });
      default:
        return [];
    }
  }, [amountNum, selectedMembers, splitMode, customAmounts, customPercents]);

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const percentTotal = useMemo(() => {
    if (splitMode !== 'percent') return 0;
    return selectedMembers.reduce(
      (sum, id) => sum + (parseFloat(customPercents[id] ?? '0') || 0),
      0
    );
  }, [splitMode, selectedMembers, customPercents]);

  const isValid = title.trim() && amountNum > 0 && splits.length > 0 && splitTotal === amountNum;

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectAll = () => setSelectedMembers(members.map((m) => m.memberId));
  const clearAll = () => setSelectedMembers([]);

  const handleSplitModeChange = (mode: SplitMode) => {
    setSplitMode(mode);
    setCustomAmounts({});
    setCustomPercents({});
  };

  const handleCancel = () => {
    if (title.trim() || amount) {
      if (!window.confirm(t('common.button.cancel') + '?')) return;
    }
    navigate(-1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !user || !isValid) return;

    setSaving(true);
    try {
      await addExpense(groupId, {
        title: title.trim(),
        amount: amountNum,
        paidBy,
        splitMode,
        splits,
        description: description.trim() || null,
        imageUrl,
        date: new Date(expenseDate),
        createdBy: user.uid,
        repeat: repeatType !== 'none'
          ? { type: repeatType, endDate: repeatEndDate ? new Date(repeatEndDate) : null }
          : null,
      });

      await recalculateSettlements(groupId);

      showToast(t('common.button.done'), 'success');
      navigate(`/groups/${groupId}`, { replace: true });
    } catch (err) {
      logger.error('expense.add', '新增帳務失敗', err);
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0 bg-base-100 z-10">
        <button className="btn btn-ghost btn-sm" onClick={handleCancel}>
          <XMarkIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">{t('expense.add')}</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSubmit}
          disabled={!isValid || saving}
        >
          {saving && <span className="loading loading-spinner loading-xs" />}
          {t('common.button.save')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-4 pb-8 flex flex-col gap-4">
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
            required
            autoFocus
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
              min={1}
              required
            />
          </div>
        </fieldset>

        {/* Paid By */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('expense.paidBy')}</legend>
          <select
            className="select w-full"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.displayName} {m.userId === user?.uid ? `(${t('group.create.creatorBadge')})` : ''}
              </option>
            ))}
          </select>
        </fieldset>

        {/* Date */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('expense.date')}</legend>
          <input
            type="datetime-local"
            className="input w-full"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </fieldset>

        {/* Split Mode */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t('expense.splitMode.label')}</legend>
          <select
            className="select w-full"
            value={splitMode}
            onChange={(e) => handleSplitModeChange(e.target.value as SplitMode)}
          >
            <option value="equal">{t('expense.splitMode.equal')}</option>
            <option value="amount">{t('expense.splitMode.amount')}</option>
            <option value="percent">{t('expense.splitMode.percent')}</option>
          </select>
        </fieldset>

        {/* Split With */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t('expense.splitWith')}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={selectAll}
              >
                {t('common.button.selectAll')}
              </button>
              <span className="text-base-content/20">|</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={clearAll}
              >
                {t('common.button.clearAll')}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {members.map((m) => {
              const isSelected = selectedMembers.includes(m.memberId);
              const splitAmount = splits.find((s) => s.memberId === m.memberId)?.amount ?? 0;

              return (
                <div key={m.memberId} className="flex items-center gap-3">
                  <label className="label cursor-pointer gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={isSelected}
                      onChange={() => toggleMember(m.memberId)}
                    />
                    <div className="avatar placeholder">
                      <div className="w-6 rounded-full bg-neutral text-neutral-content">
                        <span className="text-[10px]">{m.displayName.charAt(0)}</span>
                      </div>
                    </div>
                    <span className="label-text flex-1 truncate">{m.displayName}</span>
                  </label>

                  {splitMode === 'equal' && isSelected && amountNum > 0 && (
                    <span className="text-sm text-base-content/50 flex-shrink-0">
                      NT${splitAmount}
                    </span>
                  )}

                  {splitMode === 'amount' && isSelected && (
                    <div className="input input-sm flex items-center gap-1 w-28 flex-shrink-0">
                      <span className="text-xs text-base-content/40">NT$</span>
                      <input
                        type="number"
                        className="grow w-full"
                        placeholder="0"
                        value={customAmounts[m.memberId] ?? ''}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({ ...prev, [m.memberId]: e.target.value }))
                        }
                      />
                    </div>
                  )}

                  {splitMode === 'percent' && isSelected && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="input input-sm flex items-center gap-1 w-20">
                        <input
                          type="number"
                          className="grow w-full"
                          placeholder="0"
                          value={customPercents[m.memberId] ?? ''}
                          onChange={(e) =>
                            setCustomPercents((prev) => ({ ...prev, [m.memberId]: e.target.value }))
                          }
                        />
                        <span className="text-xs text-base-content/40">%</span>
                      </div>
                      {amountNum > 0 && (
                        <span className="text-xs text-base-content/40">
                          ${splitAmount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Split validation */}
          {amountNum > 0 && splitMode === 'amount' && (
            <div className={`text-sm mt-2 flex items-center gap-2 ${splitTotal === amountNum ? 'text-success' : 'text-error'}`}>
              <span>{t('expense.splitValidation.total', { total: splitTotal })}</span>
              <span>|</span>
              <span>{t('expense.splitValidation.remaining', { remaining: amountNum - splitTotal })}</span>
              {splitTotal === amountNum && <CheckCircleIcon className="h-4 w-4" />}
            </div>
          )}
          {amountNum > 0 && splitMode === 'percent' && (
            <div className={`text-sm mt-2 inline-flex items-center gap-1 ${percentTotal === 100 ? 'text-success' : 'text-error'}`}>
              <span>{t('expense.splitValidation.percentTotal', { percent: percentTotal })}</span>
              {percentTotal === 100 && <CheckCircleIcon className="h-4 w-4" />}
            </div>
          )}
        </div>

        {/* Expandable Details */}
        <div className="collapse collapse-arrow bg-base-200 rounded-xl">
          <input
            type="checkbox"
            checked={showDetails}
            onChange={(e) => setShowDetails(e.target.checked)}
          />
          <div className="collapse-title font-medium text-sm">
            {t('expense.details')}
          </div>
          <div className="collapse-content flex flex-col gap-4">
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

            {/* Image Upload */}
            <div>
              <label className="text-sm font-medium text-base-content/60 mb-2 block">
                {t('expense.receipt')}
              </label>
              <ImageUpload
                currentUrl={imageUrl}
                onUpload={setImageUrl}
                onRemove={() => setImageUrl(null)}
                shape="rect"
                label={t('expense.receiptUpload')}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Expandable Repeat */}
        <div className="collapse collapse-arrow bg-base-200 rounded-xl">
          <input
            type="checkbox"
            checked={showRepeat}
            onChange={(e) => setShowRepeat(e.target.checked)}
          />
          <div className="collapse-title font-medium text-sm">
            <ArrowPathIcon className="mr-1 inline h-4 w-4" />
            {t('expense.repeat.label')}{' '}
            <span className="text-base-content/50">
              {repeatType === 'none' ? t('expense.repeat.disabled') : t('expense.repeat.enabled')}
            </span>
          </div>
          <div className="collapse-content flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {(['none', 'daily', 'weekly', 'monthly'] as RepeatType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`btn btn-sm ${repeatType === type ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setRepeatType(type)}
                >
                  {t(`expense.repeat.${type}`)}
                </button>
              ))}
            </div>

            {repeatType !== 'none' && (
              <fieldset className="fieldset w-full">
                <legend className="fieldset-legend">{t('expense.repeat.endDate')}</legend>
                <input
                  type="date"
                  className="input w-full"
                  value={repeatEndDate}
                  onChange={(e) => setRepeatEndDate(e.target.value)}
                />
              </fieldset>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
