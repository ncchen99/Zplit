import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useGroupStore, type Expense, type Group } from "@/store/groupStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { updateExpense, deleteExpense } from "@/services/expenseService";
import { logger } from "@/utils/logger";
import {
  getTaipeiDateTimeLocalString,
  parseTaipeiDateTimeLocalString,
} from "@/utils/datetime";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ActionSheetSelect } from "@/components/ui/ActionSheetSelect";
import {
  Check as CheckIcon,
  Trash2 as TrashIcon,
  CircleCheck as CheckCircleIcon,
} from "lucide-react";

type SplitMode = "equal" | "amount" | "percent";

export function EditExpensePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId, expenseId } = useParams<{
    groupId: string;
    expenseId: string;
  }>();
  const storeGroup = useGroupStore((s) => s.currentGroup);
  const storeExpenses = useGroupStore((s) => s.expenses);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);
  const setExpenses = useGroupStore((s) => s.setExpenses);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const needsFetch =
    !storeGroup || storeGroup.groupId !== groupId || storeExpenses.length === 0;
  const [loading, setLoading] = useState(needsFetch);

  // Fetch from Firestore when store is empty (e.g. page refresh)
  useEffect(() => {
    if (!groupId || !needsFetch) {
      setLoading(false);
      return;
    }

    let groupLoaded = false;
    let expensesLoaded = false;
    const tryFinish = () => {
      if (groupLoaded && expensesLoaded) setLoading(false);
    };

    const groupUnsub = onSnapshot(doc(db, "groups", groupId), (snap) => {
      if (snap.exists()) {
        setCurrentGroup({ groupId: snap.id, ...snap.data() } as Group);
      }
      groupLoaded = true;
      tryFinish();
    });

    const expensesUnsub = onSnapshot(
      query(
        collection(db, `groups/${groupId}/expenses`),
        orderBy("date", "desc"),
      ),
      (snap) => {
        const expenses = snap.docs.map((d) => ({
          ...d.data(),
          expenseId: d.id,
        })) as Expense[];
        setExpenses(expenses);
        expensesLoaded = true;
        tryFinish();
      },
    );

    return () => {
      groupUnsub();
      expensesUnsub();
    };
  }, [groupId]);

  const currentGroup = storeGroup?.groupId === groupId ? storeGroup : null;
  const expense = storeExpenses.find((e) => e.expenseId === expenseId);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {},
  );
  const [customPercents, setCustomPercents] = useState<Record<string, string>>(
    {},
  );
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [expenseDate, setExpenseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const members = currentGroup?.members ?? [];

  // Initialize form from existing expense
  useEffect(() => {
    if (initialized || !expense) return;
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setPaidBy(expense.paidBy);
    setSplitMode(expense.splitMode);
    setSelectedMembers(expense.splits.map((s) => s.memberId));
    setDescription(expense.description ?? "");
    setImageUrl(expense.imageUrl ?? null);
    if (expense.description || expense.imageUrl) setShowDetails(true);

    if (expense.splitMode === "amount") {
      const amounts: Record<string, string> = {};
      expense.splits.forEach((s) => {
        amounts[s.memberId] = String(s.amount);
      });
      setCustomAmounts(amounts);
    }
    if (expense.splitMode === "percent") {
      const percents: Record<string, string> = {};
      expense.splits.forEach((s) => {
        percents[s.memberId] = String(
          Math.round((s.amount / expense.amount) * 100),
        );
      });
      setCustomPercents(percents);
    }

    if (expense.date?.seconds) {
      setExpenseDate(
        getTaipeiDateTimeLocalString(new Date(expense.date.seconds * 1000)),
      );
    }
    setInitialized(true);
  }, [expense, initialized]);

  const amountNum = parseInt(amount) || 0;

  const splits = useMemo(() => {
    if (!amountNum || selectedMembers.length === 0) return [];
    switch (splitMode) {
      case "equal": {
        const perPerson = Math.floor(amountNum / selectedMembers.length);
        const remainder = amountNum - perPerson * selectedMembers.length;
        return selectedMembers.map((memberId, i) => ({
          memberId,
          amount: perPerson + (i < remainder ? 1 : 0),
        }));
      }
      case "amount":
        return selectedMembers.map((memberId) => ({
          memberId,
          amount: parseInt(customAmounts[memberId] ?? "0") || 0,
        }));
      case "percent":
        return selectedMembers.map((memberId) => {
          const pct = parseFloat(customPercents[memberId] ?? "0") || 0;
          return { memberId, amount: Math.round((amountNum * pct) / 100) };
        });
      default:
        return [];
    }
  }, [amountNum, selectedMembers, splitMode, customAmounts, customPercents]);

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const percentTotal = useMemo(() => {
    if (splitMode !== "percent") return 0;
    return selectedMembers.reduce(
      (sum, id) => sum + (parseFloat(customPercents[id] ?? "0") || 0),
      0,
    );
  }, [splitMode, selectedMembers, customPercents]);

  const isValid =
    title.trim() &&
    amountNum > 0 &&
    splits.length > 0 &&
    splitTotal === amountNum;

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  };

  const selectAll = () => setSelectedMembers(members.map((m) => m.memberId));
  const clearAll = () => setSelectedMembers([]);

  const handleSplitModeChange = (mode: SplitMode) => {
    setSplitMode(mode);
    if (mode !== "equal") {
      setSelectedMembers(members.map((m) => m.memberId));
    }
    setCustomAmounts({});
    setCustomPercents({});
  };

  const handleBack = () => {
    setShowDiscardModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !expenseId || !user || !isValid) return;

    setSaving(true);
    try {
      await updateExpense(
        groupId,
        expenseId,
        {
          title: title.trim(),
          amount: amountNum,
          paidBy,
          splitMode,
          splits,
          description: description.trim() || null,
          imageUrl,
          date: parseTaipeiDateTimeLocalString(expenseDate),
        },
        user.uid,
      );

      showToast(t("common.toast.saved"), "success");
      navigate(`/groups/${groupId}/expenses/${expenseId}`, { replace: true });
    } catch (err) {
      logger.error("expense.edit", "Failed to update expense", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!groupId || !expense || !user) return;
    setSaving(true);
    try {
      await deleteExpense(
        groupId,
        {
          expenseId: expense.expenseId,
          title: expense.title,
          amount: expense.amount,
        },
        user.uid,
      );
      showToast(t("common.button.done"), "success");
      navigate(`/groups/${groupId}`, { replace: true });
    } catch (err) {
      logger.error("expense.delete", "Failed to delete expense", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !expense) {
    return (
      <div className="flex min-h-[100dvh] md:min-h-[inherit] flex-col">
        <PageHeader title={t("expense.edit")} onBack={() => navigate(-1)} />
        <div className="px-4 pt-4 space-y-4">
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] md:min-h-[inherit] flex-col">
      <PageHeader
        title={t("expense.edit")}
        onBack={handleBack}
        sticky
        rightAction={
          <HeaderIconButton
            onClick={() =>
              handleSubmit({ preventDefault: () => {} } as React.FormEvent)
            }
            disabled={!isValid || saving}
            loading={saving}
            tone="primary"
          >
            <CheckIcon className="h-5 w-5" />
          </HeaderIconButton>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="flex-1 px-4 pb-8 flex flex-col gap-4"
      >
        {/* Title */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.title")}</legend>
          <input
            type="text"
            className="input w-full"
            placeholder={t("expense.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            required
          />
        </fieldset>

        {/* Amount */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.amount")}</legend>
          <div className="input flex items-center gap-2 w-full">
            <span className="text-base-content/50 font-semibold">NT$</span>
            <input
              type="number"
              className="grow"
              placeholder={t("expense.amountPlaceholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              required
            />
          </div>
        </fieldset>

        {/* Paid By */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.paidBy")}</legend>
          <ActionSheetSelect
            ariaLabel={t("expense.paidBy")}
            placeholder={t("expense.paidBy")}
            value={paidBy}
            onChange={setPaidBy}
            options={members.map((m) => ({
              value: m.memberId,
              label: m.displayName,
              avatarUrl: m.avatarUrl,
            }))}
          />
        </fieldset>

        {/* Date */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.date")}</legend>
          <input
            type="datetime-local"
            className="input w-full"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </fieldset>

        {/* Split Mode */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">
            {t("expense.splitMode.label")}
          </legend>
          <ActionSheetSelect
            ariaLabel={t("expense.splitMode.label")}
            placeholder={t("expense.splitMode.label")}
            value={splitMode}
            onChange={(value) => handleSplitModeChange(value as SplitMode)}
            showAvatar={false}
            options={[
              { value: "equal", label: t("expense.splitMode.equal") },
              { value: "amount", label: t("expense.splitMode.amount") },
              { value: "percent", label: t("expense.splitMode.percent") },
            ]}
          />
        </fieldset>

        {/* Split With */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {t("expense.splitWith")}
            </span>
            {splitMode === "equal" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={selectAll}
                >
                  {t("common.button.selectAll")}
                </button>
                <span className="text-base-content/20">|</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={clearAll}
                >
                  {t("common.button.clearAll")}
                </button>
              </div>
            )}
          </div>

          {splitMode === "equal" && (
            <form className="filter mb-3 flex w-full flex-wrap gap-2">
              {members.map((m) => {
                const isSelected = selectedMembers.includes(m.memberId);
                return (
                  <label
                    key={m.memberId}
                    className={`btn h-auto min-h-11 gap-2 bg-base-100 px-3 text-base-content hover:bg-base-200 ${isSelected ? "border-success" : "border-base-300"}`}
                  >
                    <input
                      type="checkbox"
                      name="split-members"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => toggleMember(m.memberId)}
                    />
                    {isSelected ? (
                      <input
                        type="checkbox"
                        checked
                        readOnly
                        className="checkbox checkbox-primary checkbox-sm pointer-events-none"
                        aria-label={m.displayName}
                      />
                    ) : (
                      <UserAvatar
                        src={m.avatarUrl}
                        name={m.displayName}
                        size="w-6"
                        textSize="text-[10px]"
                        bgClass="bg-base-300 text-base-content"
                      />
                    )}
                    <span className="max-w-24 truncate text-xs">
                      {m.displayName}
                    </span>
                  </label>
                );
              })}
            </form>
          )}

          {splitMode !== "equal" && (
            <div className="flex flex-col gap-2">
              {members.map((m) => {
                const splitAmount =
                  splits.find((s) => s.memberId === m.memberId)?.amount ?? 0;
                return (
                  <div key={m.memberId} className="flex items-center gap-3">
                    <div className="label gap-2 flex-1 min-w-0">
                      <UserAvatar
                        src={m.avatarUrl}
                        name={m.displayName}
                        size="w-6"
                        textSize="text-[10px]"
                        bgClass="bg-base-300 text-base-content"
                      />
                      <span className="label-text flex-1 truncate">
                        {m.displayName}
                        {splitMode === "percent" &&
                          amountNum > 0 &&
                          splitAmount > 0 && (
                            <span className="ml-2 text-xs text-base-content/50">
                              <span className="mx-1 text-base-content/30">
                                |
                              </span>
                              NT${splitAmount}
                            </span>
                          )}
                      </span>
                    </div>

                    {splitMode === "amount" && (
                      <div className="input input-sm flex items-center gap-1 w-28 flex-shrink-0">
                        <span className="text-xs text-base-content/40">
                          NT$
                        </span>
                        <input
                          type="number"
                          className="grow w-full"
                          placeholder="0"
                          value={customAmounts[m.memberId] ?? ""}
                          onChange={(e) =>
                            setCustomAmounts((prev) => ({
                              ...prev,
                              [m.memberId]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    )}

                    {splitMode === "percent" && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="input input-sm flex items-center gap-1 w-20">
                          <input
                            type="number"
                            className="grow w-full"
                            placeholder="0"
                            value={customPercents[m.memberId] ?? ""}
                            onChange={(e) =>
                              setCustomPercents((prev) => ({
                                ...prev,
                                [m.memberId]: e.target.value,
                              }))
                            }
                          />
                          <span className="text-xs text-base-content/40">
                            %
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Split validation */}
          {amountNum > 0 && splitMode === "amount" && (
            <div
              className={`text-sm mt-2 flex items-center gap-2 ${splitTotal === amountNum ? "text-success" : "text-error"}`}
            >
              <span>
                {t("expense.splitValidation.total", { total: splitTotal })}
              </span>
              <span>|</span>
              <span>
                {t("expense.splitValidation.remaining", {
                  remaining: amountNum - splitTotal,
                })}
              </span>
              {splitTotal === amountNum && (
                <CheckCircleIcon className="h-4 w-4" />
              )}
            </div>
          )}
          {amountNum > 0 && splitMode === "percent" && (
            <div
              className={`text-sm mt-2 inline-flex items-center gap-1 ${percentTotal === 100 ? "text-success" : "text-error"}`}
            >
              <span>
                {t("expense.splitValidation.percentTotal", {
                  percent: percentTotal,
                })}
              </span>
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
            {t("expense.details")}
          </div>
          <div className="collapse-content flex flex-col gap-4">
            <fieldset className="fieldset w-full">
              <legend className="fieldset-legend">
                {t("expense.description")}
              </legend>
              <textarea
                className="textarea w-full"
                placeholder={t("expense.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </fieldset>
            <div>
              <label className="text-sm font-medium text-base-content/60 mb-2 block">
                {t("expense.receipt")}
              </label>
              <ImageUpload
                currentUrl={imageUrl}
                onUpload={setImageUrl}
                onRemove={() => setImageUrl(null)}
                shape="rect"
                rectHeightClass="h-44 sm:h-56"
                label={t("expense.receiptUpload")}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="divider mt-1 mb-1" />
          {/* <h3 className="font-semibold text-sm text-error/70 uppercase tracking-wider mb-3">
            {t('group.settings.dangerZone')}
          </h3> */}
          <button
            type="button"
            className="btn-danger-soft w-full mt-4 mb-4"
            onClick={() => setShowDeleteModal(true)}
          >
            <TrashIcon className="h-4 w-4" />
            {t("common.button.delete")}
          </button>
        </div>
      </form>

      {/* Discard modal */}
      {showDiscardModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold">{t("common.discard.title")}</h3>
            <p className="mt-2 text-sm text-base-content/70">
              {t("common.discard.message")}
            </p>
            <div className="modal-action">
              <button
                className="btn-white-soft"
                onClick={() => setShowDiscardModal(false)}
              >
                {t("common.discard.cancel")}
              </button>
              <button className="btn-danger-soft" onClick={() => navigate(-1)}>
                {t("common.discard.confirm")}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowDiscardModal(false)}
          />
        </div>
      )}

      {/* Delete modal */}
      <ConfirmModal
        open={showDeleteModal}
        title={t("common.button.delete")}
        message={t("expense.deleteConfirm")}
        confirmLabel={t("common.button.delete")}
        confirmVariant="btn-error"
        cancelLabel={t("common.button.cancel")}
        onConfirm={() => {
          setShowDeleteModal(false);
          handleDelete();
        }}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
