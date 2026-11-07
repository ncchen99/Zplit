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
import { CalculatorInput } from "@/components/ui/CalculatorInput";
import { PageHeader, HeaderSubmitButton } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ActionSheetSelect } from "@/components/ui/ActionSheetSelect";
import { SplitMemberPicker } from "./SplitMemberPicker";
import { useGroupMemberGuard } from "./groupAccess";
import { getExpenseFormIssues, type SplitMode } from "./expenseFormIssues";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  Trash2 as TrashIcon,
  CircleCheck as CheckCircleIcon,
} from "lucide-react";

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
  }, [groupId, needsFetch, setCurrentGroup, setExpenses]);

  const currentGroup = storeGroup?.groupId === groupId ? storeGroup : null;
  const isMember = useGroupMemberGuard(groupId, currentGroup);
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

  // 自己永遠排在分帳對象的第一個（與 AddExpensePage 一致）
  const myMemberId =
    members.find((m) => m.userId === user?.uid)?.memberId ?? null;
  const orderedMembers = myMemberId
    ? [
        ...members.filter((m) => m.memberId === myMemberId),
        ...members.filter((m) => m.memberId !== myMemberId),
      ]
    : members;

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

  // 依金額／比例分帳時畫面上每個成員都有輸入框，全部都要算進去；
  // 原本帳務裡已被移出群組的成員沒有輸入框，但金額要保留
  const splitMemberIds =
    splitMode === "equal"
      ? selectedMembers
      : [
          ...orderedMembers.map((m) => m.memberId),
          ...selectedMembers.filter(
            (id) => !orderedMembers.some((m) => m.memberId === id),
          ),
        ];

  // 依金額分帳時，總金額就是每個人金額的加總：不用先在上面算好總數、下面再填一次
  const customAmountParts =
    splitMode === "amount"
      ? splitMemberIds
          .map((id) => parseInt(customAmounts[id] ?? "") || 0)
          .filter((n) => n > 0)
      : [];
  const amountNum =
    splitMode === "amount"
      ? customAmountParts.reduce((sum, n) => sum + n, 0)
      : parseInt(amount) || 0;

  const splitKey = splitMemberIds.join(",");
  const splits = useMemo(() => {
    const ids = splitKey ? splitKey.split(",") : [];
    if (!amountNum || ids.length === 0) return [];
    switch (splitMode) {
      case "equal": {
        const perPerson = Math.floor(amountNum / ids.length);
        const remainder = amountNum - perPerson * ids.length;
        return ids.map((memberId, i) => ({
          memberId,
          amount: perPerson + (i < remainder ? 1 : 0),
        }));
      }
      case "amount":
        return ids.map((memberId) => ({
          memberId,
          amount: Math.max(0, parseInt(customAmounts[memberId] ?? "0") || 0),
        }));
      case "percent":
        return ids.map((memberId) => {
          const pct = parseFloat(customPercents[memberId] ?? "0") || 0;
          return { memberId, amount: Math.round((amountNum * pct) / 100) };
        });
      default:
        return [];
    }
  }, [amountNum, splitKey, splitMode, customAmounts, customPercents]);

  // 與新增頁一致：分到 0 元的成員代表沒有一起分帳，不寫進帳務
  const splitsToSave = useMemo(
    () => splits.filter((s) => s.amount > 0),
    [splits],
  );

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const percentTotal =
    splitMode === "percent"
      ? splitMemberIds.reduce(
          (sum, id) => sum + (parseFloat(customPercents[id] ?? "0") || 0),
          0,
        )
      : 0;

  const { ready, errorOf, guard } = useSubmitGuard(
    getExpenseFormIssues(
      {
        title,
        amountNum,
        paidBy,
        splitMode,
        selectedCount: splitMemberIds.length,
        splitTotal,
        savedSplitCount: splitsToSave.length,
        percentTotal,
      },
      t,
    ),
  );

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  };

  const selectAll = () => setSelectedMembers(members.map((m) => m.memberId));
  const clearAll = () => setSelectedMembers([]);
  const selectOnlyMe = () => setSelectedMembers(myMemberId ? [myMemberId] : []);

  const handleSplitModeChange = (mode: SplitMode) => {
    // 從依金額分帳切走時，把加總好的金額留給新的模式用
    if (splitMode === "amount" && amountNum > 0) setAmount(String(amountNum));
    setSplitMode(mode);
    if (mode !== "equal") {
      setSelectedMembers(members.map((m) => m.memberId));
    }
    setCustomAmounts({});
    setCustomPercents({});
  };

  // 表單剛帶入原本帳務時的樣子；跟現在不一樣才算有未儲存的變更
  const formSnapshot = JSON.stringify([
    title,
    amount,
    paidBy,
    splitMode,
    selectedMembers,
    customAmounts,
    customPercents,
    description,
    imageUrl,
    expenseDate,
  ]);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  useEffect(() => {
    if (initialized && initialSnapshot === null) {
      setInitialSnapshot(formSnapshot);
    }
  }, [initialized, initialSnapshot, formSnapshot]);
  const isDirty = initialSnapshot !== null && formSnapshot !== initialSnapshot;
  // 系統返回（Android 返回鍵、側滑）也要先問，不然改到一半的內容就直接不見
  const { leave, release } = useUnsavedChangesGuard(isDirty, () =>
    setShowDiscardModal(true),
  );

  const handleBack = () => {
    if (isDirty) {
      setShowDiscardModal(true);
      return;
    }
    navigate(-1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !expenseId || !user || saving) return;
    if (!guard()) return;

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
          splits: splitsToSave,
          description: description.trim() || null,
          imageUrl,
          date: parseTaipeiDateTimeLocalString(expenseDate),
        },
        user.uid,
      );

      showToast(t("common.toast.saved"), "success");
      await release();
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
      await release();
      navigate(`/groups/${groupId}`, { replace: true });
    } catch (err) {
      logger.error("expense.delete", "Failed to delete expense", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  // 還在確認成員身份時也維持骨架，不讓非成員看到表單
  if (loading || !expense || !isMember) {
    return (
      <div className="flex min-h-full md:min-h-[inherit] flex-col">
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
    <div className="flex min-h-full md:min-h-[inherit] flex-col">
      <PageHeader
        title={t("expense.edit")}
        onBack={handleBack}
        sticky
        rightAction={
          <HeaderSubmitButton
            onClick={() =>
              handleSubmit({ preventDefault: () => {} } as React.FormEvent)
            }
            ready={ready}
            loading={saving}
          >
            {t("common.button.done")}
          </HeaderSubmitButton>
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
            className={`input w-full ${errorOf("title") ? "input-error" : ""}`}
            placeholder={t("expense.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
          />
          {errorOf("title") && (
            <p className="text-xs text-error">{errorOf("title")}</p>
          )}
        </fieldset>

        {/* Amount */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.amount")}</legend>
          <CalculatorInput
            value={
              splitMode === "amount"
                ? amountNum > 0
                  ? String(amountNum)
                  : ""
                : amount
            }
            onChange={setAmount}
            placeholder={t("expense.amountPlaceholder")}
            readOnly={splitMode === "amount"}
            invalid={!!errorOf("amount")}
          />
          {splitMode === "amount" && (
            <p className="text-xs text-base-content/60 break-words">
              {customAmountParts.length > 0
                ? t("expense.autoTotal.formula", {
                    formula: customAmountParts.join(" + "),
                  })
                : t("expense.autoTotal.empty")}
            </p>
          )}
          {errorOf("amount") && (
            <p className="text-xs text-error">{errorOf("amount")}</p>
          )}
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
          {errorOf("paidBy") && (
            <p className="text-xs text-error">{errorOf("paidBy")}</p>
          )}
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
                {myMemberId && (
                  <>
                    <span className="text-base-content/20">|</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={selectOnlyMe}
                    >
                      {t("common.button.onlyMe")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {splitMode === "equal" && (
            <SplitMemberPicker
              members={orderedMembers}
              selectedMemberIds={selectedMembers}
              onToggle={toggleMember}
              perPersonAmount={
                selectedMembers.length
                  ? Math.floor(amountNum / selectedMembers.length)
                  : 0
              }
            />
          )}

          {splitMode !== "equal" && (
            <div className="flex flex-col gap-2">
              {orderedMembers.map((m) => {
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

          {/* Split validation：依金額分帳的總金額直接由加總而來，只顯示總計 */}
          {amountNum > 0 && splitMode === "amount" && (
            <div className="text-sm mt-2 text-base-content/60">
              {t("expense.splitValidation.total", { total: amountNum })}
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
          {errorOf("split") && (
            <p className="text-sm mt-2 text-error">{errorOf("split")}</p>
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
              <button className="btn-danger-soft" onClick={leave}>
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
