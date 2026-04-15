import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useGroupStore } from "@/store/groupStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { addExpense } from "@/services/expenseService";
import { getGroupById } from "@/services/groupService";
import { logger } from "@/utils/logger";
import {
  getTaipeiDateTimeLocalString,
  parseTaipeiDateTimeLocalString,
} from "@/utils/datetime";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { CalculatorInput } from "@/components/ui/CalculatorInput";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ActionSheetSelect } from "@/components/ui/ActionSheetSelect";
import {
  Check as CheckIcon,
  CircleCheck as CheckCircleIcon,
} from "lucide-react";

type SplitMode = "equal" | "amount" | "percent";

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

  const members = useMemo(() => currentGroup?.members ?? [], [currentGroup]);

  // 若 currentGroup 不在 store（例如直接導航到此頁），從 Firestore 載入
  useEffect(() => {
    if (!groupId || currentGroup?.groupId === groupId) return;
    getGroupById(groupId)
      .then((group) => {
        if (group) setCurrentGroup(group);
      })
      .catch((err) => logger.error("addExpense", "載入群組失敗", err));
  }, [currentGroup?.groupId, groupId, setCurrentGroup]);

  // 當成員列表第一次有資料時，初始化 paidBy（找到當前使用者的 memberId）和 selectedMembers
  useEffect(() => {
    if (membersInitialized || members.length === 0) return;
    const myMember = members.find((m) => m.userId === user?.uid);
    setPaidBy(myMember?.memberId ?? members[0]?.memberId ?? "");
    setSelectedMembers(members.map((m) => m.memberId));
    setMembersInitialized(true);
  }, [members, membersInitialized, user?.uid]);

  const amountNum = parseInt(amount) || 0;

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
          amount: parseInt(customAmounts[memberId] ?? "0") || 0,
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
    paidBy &&
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
    if (title.trim() || amount) {
      setShowDiscardModal(true);
      return;
    }
    navigate(-1);
  };

  const submitExpense = async () => {
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
        date: parseTaipeiDateTimeLocalString(expenseDate),
        createdBy: user.uid,
      });

      showToast(t("common.toast.expenseAdded"), "success");
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

  return (
    <div className="flex min-h-[100dvh] md:min-h-[inherit] flex-col">
      <PageHeader
        title={t("expense.add")}
        onBack={handleBack}
        sticky
        rightAction={
          <HeaderIconButton
            onClick={submitExpense}
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
            autoFocus
          />
        </fieldset>

        {/* Amount */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.amount")}</legend>
          <CalculatorInput
            value={amount}
            onChange={setAmount}
            placeholder={t("expense.amountPlaceholder")}
          />
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
              </div>
            )}
          </div>

          {splitMode === "equal" && (
            <div className="filter mb-3 flex w-full flex-wrap gap-2">
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
                    <span className="max-w-20 truncate text-xs">
                      {m.displayName}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* 平均分帳改由上方 filter 直接控制，不再顯示重複名單 */}
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
    </div>
  );
}
