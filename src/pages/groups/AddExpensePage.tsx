import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useGroupStore } from "@/store/groupStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { addExpense } from "@/services/expenseService";
import { getGroupById } from "@/services/groupService";
import { logger } from "@/utils/logger";
import { cacheThenServer } from "@/lib/firestoreRead";
import {
  getTaipeiDateTimeLocalString,
  parseTaipeiDateTimeLocalString,
} from "@/utils/datetime";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { CalculatorInput } from "@/components/ui/CalculatorInput";
import { PageHeader, HeaderSubmitButton } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ActionSheetSelect } from "@/components/ui/ActionSheetSelect";
import { SplitMemberPicker } from "./SplitMemberPicker";
import { useGroupMemberGuard } from "./groupAccess";
import { getExpenseFormIssues, type SplitMode } from "./expenseFormIssues";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { CircleCheck as CheckCircleIcon } from "lucide-react";

export function AddExpensePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [membersInitialized, setMembersInitialized] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {},
  );
  const [customPercents, setCustomPercents] = useState<Record<string, string>>(
    {},
  );
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [expenseDate, setExpenseDate] = useState(() =>
    getTaipeiDateTimeLocalString(),
  );
  const [saving, setSaving] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // 只採用網址上這個群組的資料，不然 store 裡上一個群組的成員會被拿來初始化分帳對象
  const group = currentGroup?.groupId === groupId ? currentGroup : null;
  const isMember = useGroupMemberGuard(groupId, group);
  const members = useMemo(() => group?.members ?? [], [group]);

  // 自己永遠排在分帳對象的第一個：幾乎每一筆帳都要判斷「我在不在裡面」，
  // 固定在第一格就不用每次重新找
  const myMemberId = useMemo(
    () => members.find((m) => m.userId === user?.uid)?.memberId ?? null,
    [members, user?.uid],
  );
  const orderedMembers = useMemo(() => {
    if (!myMemberId) return members;
    const me = members.filter((m) => m.memberId === myMemberId);
    return [...me, ...members.filter((m) => m.memberId !== myMemberId)];
  }, [members, myMemberId]);

  // 若 currentGroup 不在 store（例如直接導航到此頁），從 Firestore 載入
  useEffect(() => {
    if (!groupId || currentGroup?.groupId === groupId) return;
    cacheThenServer(
      (source) => getGroupById(groupId, source),
      (group) => {
        if (group) setCurrentGroup(group);
      },
    ).catch((err) => logger.error("addExpense", "載入群組失敗", err));
  }, [currentGroup?.groupId, groupId, setCurrentGroup]);

  // 當成員列表第一次有資料時，初始化 paidBy（找到當前使用者的 memberId）和 selectedMembers
  useEffect(() => {
    if (membersInitialized || members.length === 0) return;
    const myMember = members.find((m) => m.userId === user?.uid);
    setPaidBy(myMember?.memberId ?? members[0]?.memberId ?? "");
    setSelectedMembers(members.map((m) => m.memberId));
    setMembersInitialized(true);
  }, [members, membersInitialized, user?.uid]);

  // 依金額分帳時，總金額就是每個人金額的加總：不用先在上面算好總數、下面再填一次
  const customAmountParts = useMemo(
    () =>
      splitMode === "amount"
        ? orderedMembers
            .map((m) => parseInt(customAmounts[m.memberId] ?? "") || 0)
            .filter((n) => n > 0)
        : [],
    [splitMode, orderedMembers, customAmounts],
  );
  const amountNum =
    splitMode === "amount"
      ? customAmountParts.reduce((sum, n) => sum + n, 0)
      : parseInt(amount) || 0;

  // Calculate splits based on mode
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
          amount: Math.max(0, parseInt(customAmounts[memberId] ?? "0") || 0),
        }));
      case "percent":
        return selectedMembers.map((memberId) => {
          const pct = parseFloat(customPercents[memberId] ?? "0") || 0;
          return {
            memberId,
            amount: Math.round((amountNum * pct) / 100),
          };
        });
      default:
        return [];
    }
  }, [amountNum, selectedMembers, splitMode, customAmounts, customPercents]);

  // 按金額／比例（甚至金額小於人數的平均）都可能讓人分到 0 元，
  // 那代表這個人沒有一起分帳，不該寫進帳務裡
  const splitsToSave = useMemo(
    () => splits.filter((s) => s.amount > 0),
    [splits],
  );

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const percentTotal = useMemo(() => {
    if (splitMode !== "percent") return 0;
    return selectedMembers.reduce(
      (sum, id) => sum + (parseFloat(customPercents[id] ?? "0") || 0),
      0,
    );
  }, [splitMode, selectedMembers, customPercents]);

  const { ready, errorOf, guard } = useSubmitGuard(
    getExpenseFormIssues(
      {
        title,
        amountNum,
        paidBy,
        splitMode,
        selectedCount: selectedMembers.length,
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

  const isDirty = !!(
    title.trim() ||
    amount ||
    amountNum > 0 ||
    description.trim() ||
    imageUrl
  );
  // 系統返回（Android 返回鍵、側滑）也要先問，不然填到一半的內容就直接不見
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

  const submitExpense = async () => {
    if (!groupId || !user || saving) return;
    if (!guard()) return;

    setSaving(true);
    try {
      await addExpense(groupId, {
        title: title.trim(),
        amount: amountNum,
        paidBy,
        splitMode,
        splits: splitsToSave,
        description: description.trim() || null,
        imageUrl,
        date: parseTaipeiDateTimeLocalString(expenseDate),
        createdBy: user.uid,
      });

      showToast(t("common.toast.expenseAdded"), "success");
      await release();
      navigate(`/groups/${groupId}`, { replace: true });
    } catch (err) {
      logger.error("expense.add", "新增帳務失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitExpense();
  };

  // 群組還沒載入，或還在確認成員身份：先顯示骨架，不讓非成員看到表單
  if (!isMember) {
    return (
      <div className="flex min-h-full md:min-h-[inherit] flex-col">
        <PageHeader title={t("expense.add")} onBack={() => navigate(-1)} />
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
        title={t("expense.add")}
        onBack={handleBack}
        sticky
        rightAction={
          <HeaderSubmitButton
            onClick={submitExpense}
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
            autoFocus
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
        <fieldset className="fieldset w-full">
          <div className="flex items-center justify-between">
            <span className="fieldset-legend !m-0">{t("expense.splitWith")}</span>
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

          {/* 平均分帳改由上方 picker 直接控制，不再顯示重複名單 */}
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
        </fieldset>

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

            {/* Image Upload */}
            <fieldset className="fieldset w-full">
              <legend className="fieldset-legend">{t("expense.receipt")}</legend>
              <ImageUpload
                currentUrl={imageUrl}
                onUpload={setImageUrl}
                onRemove={() => setImageUrl(null)}
                shape="rect"
                rectHeightClass="h-44 sm:h-56"
                label={t("expense.receiptUpload")}
                className="w-full"
              />
            </fieldset>
          </div>
        </div>
      </form>

      {/* Discard confirmation modal */}
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
    </div>
  );
}
