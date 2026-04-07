import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useGroupStore } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { addExpense } from '@/services/expenseService';
import { recalculateSettlements } from '@/services/settlementService';
import { logger } from '@/utils/logger';

type SplitMode = 'equal' | 'amount' | 'percent';

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
  const [showDetails, setShowDetails] = useState(false);
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
  const isValid = title.trim() && amountNum > 0 && splits.length > 0 && splitTotal === amountNum;

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
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
        imageUrl: null,
        date: new Date(),
        createdBy: user.uid,
      });

      // Recalculate settlements
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
    <div className="px-4 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button className="btn btn-ghost btn-sm btn-circle" onClick={() => navigate(-1)}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">{t('expense.add')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Title */}
        <label className="form-control w-full">
          <div className="label"><span className="label-text">{t('expense.title')}</span></div>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder={t('expense.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            required
            autoFocus
          />
        </label>

        {/* Amount */}
        <label className="form-control w-full">
          <div className="label"><span className="label-text">{t('expense.amount')}</span></div>
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="text-base-content/50">NT$</span>
            <input
              type="number"
              className="grow"
              placeholder={t('expense.amountPlaceholder')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              required
            />
          </label>
        </label>

        {/* Paid By */}
        <label className="form-control w-full">
          <div className="label"><span className="label-text">{t('expense.paidBy')}</span></div>
          <select
            className="select select-bordered w-full"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.displayName}
              </option>
            ))}
          </select>
        </label>

        {/* Split Mode */}
        <label className="form-control w-full">
          <div className="label"><span className="label-text">{t('expense.splitMode.label')}</span></div>
          <select
            className="select select-bordered w-full"
            value={splitMode}
            onChange={(e) => setSplitMode(e.target.value as SplitMode)}
          >
            <option value="equal">{t('expense.splitMode.equal')}</option>
            <option value="amount">{t('expense.splitMode.amount')}</option>
            <option value="percent">{t('expense.splitMode.percent')}</option>
          </select>
        </label>

        {/* Split With */}
        <div>
          <div className="label"><span className="label-text">{t('expense.splitWith')}</span></div>
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.memberId} className="flex items-center gap-3">
                <label className="label cursor-pointer gap-2 flex-1">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm"
                    checked={selectedMembers.includes(m.memberId)}
                    onChange={() => toggleMember(m.memberId)}
                  />
                  <span className="label-text flex-1">{m.displayName}</span>
                </label>

                {/* Custom amount/percent input */}
                {splitMode === 'amount' && selectedMembers.includes(m.memberId) && (
                  <input
                    type="number"
                    className="input input-bordered input-sm w-24"
                    placeholder="0"
                    value={customAmounts[m.memberId] ?? ''}
                    onChange={(e) =>
                      setCustomAmounts((prev) => ({ ...prev, [m.memberId]: e.target.value }))
                    }
                  />
                )}
                {splitMode === 'percent' && selectedMembers.includes(m.memberId) && (
                  <label className="input input-bordered input-sm flex items-center gap-1 w-24">
                    <input
                      type="number"
                      className="grow w-full"
                      placeholder="0"
                      value={customPercents[m.memberId] ?? ''}
                      onChange={(e) =>
                        setCustomPercents((prev) => ({ ...prev, [m.memberId]: e.target.value }))
                      }
                    />
                    <span className="text-base-content/50">%</span>
                  </label>
                )}

                {/* Show split amount for equal mode */}
                {splitMode === 'equal' && selectedMembers.includes(m.memberId) && amountNum > 0 && (
                  <span className="text-sm text-base-content/50">
                    NT${splits.find((s) => s.memberId === m.memberId)?.amount ?? 0}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Split total indicator */}
          {amountNum > 0 && splitMode !== 'equal' && (
            <div className={`text-sm mt-2 ${splitTotal === amountNum ? 'text-success' : 'text-error'}`}>
              Total: NT${splitTotal} / NT${amountNum}
              {splitTotal !== amountNum && ' (mismatch)'}
            </div>
          )}
        </div>

        {/* Expandable Details */}
        <div className="collapse collapse-arrow bg-base-200">
          <input
            type="checkbox"
            checked={showDetails}
            onChange={(e) => setShowDetails(e.target.checked)}
          />
          <div className="collapse-title font-medium text-sm">
            {t('expense.details')}
          </div>
          <div className="collapse-content">
            <label className="form-control w-full">
              <div className="label"><span className="label-text">{t('expense.description')}</span></div>
              <textarea
                className="textarea textarea-bordered w-full"
                placeholder={t('expense.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </label>
            {/* TODO: Image upload (M2-11) */}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn btn-primary btn-block mt-2"
          disabled={!isValid || saving}
        >
          {saving && <span className="loading loading-spinner loading-sm" />}
          {t('common.button.save')}
        </button>
      </form>
    </div>
  );
}
