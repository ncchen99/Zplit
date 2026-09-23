import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useGroupStore } from "@/store/groupStore";
import {
  computeSettlementPlan,
  type SettlementResult,
} from "@/lib/algorithm/settlement";
import { addExpense } from "@/services/expenseService";
import {
  hasBankAccount,
  subscribePayees,
  type PaymentAccount,
} from "@/services/paymentService";
import { formatAccountNumber, formatBank } from "@/lib/banks";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { logger } from "@/utils/logger";
import { copyToClipboard } from "@/utils/clipboard";
import {
  ArrowRight as ArrowRightIcon,
  Sparkles as SparklesIcon,
  Check as CheckIcon,
  Copy as CopyIcon,
  ChevronRight as ChevronRightIcon,
  Landmark as LandmarkIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useGroupAccess } from "../groupAccess";

export function SettleTab() {
  const { t } = useTranslation();
  const expenses = useGroupStore((s) => s.expenses);
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const { canEdit } = useGroupAccess();
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [pendingDebt, setPendingDebt] = useState<SettlementResult | null>(null);
  const [transferDebt, setTransferDebt] = useState<SettlementResult | null>(
    null,
  );
  const navigate = useNavigate();
  const groupId = currentGroup?.groupId;

  // 成員的收款帳號（key 是 userId）。只有成員讀得到，預覽模式不訂閱；null = 還沒載入
  const [payees, setPayees] = useState<Map<string, PaymentAccount> | null>(
    null,
  );
  useEffect(() => {
    if (!groupId || !canEdit) return;
    return subscribePayees(groupId, setPayees);
  }, [canEdit, groupId]);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(currentGroup?.memberNameMap ?? {}).forEach(
      ([memberId, displayName]) => {
        map.set(memberId, displayName);
      },
    );
    currentGroup?.members?.forEach((m) => {
      map.set(m.memberId, m.displayName);
    });
    return map;
  }, [currentGroup]);

  const memberAvatarMap = useMemo(() => {
    const map = new Map<string, string | null>();
    currentGroup?.members?.forEach((m) => map.set(m.memberId, m.avatarUrl));
    return map;
  }, [currentGroup]);

  const myMemberId =
    currentGroup?.members?.find((m) => m.userId === user?.uid)?.memberId ??
    null;

  /**
   * 剩餘待結清債務：從帳款（含已建立的結算帳款）算出的結算建議。
   * 結清只會拿掉對應的那一列，其他人的列不會因此重新配對（見 computeSettlementPlan）。
   *
   * 排序把跟自己有關的提到最前面（先「我要付」再「要付給我」），其餘維持原順序。
   * 只動順序、不加「你」之類的個人化標籤——這一頁常常被整張截圖丟進群組，
   * 標籤會讓其他人看不懂那一列在講誰。
   */
  const remainingDebts = useMemo(() => {
    if (!expenses.length) return [];
    const debts = computeSettlementPlan(expenses);
    if (!myMemberId) return debts;
    const rank = (d: SettlementResult) =>
      d.from === myMemberId ? 0 : d.to === myMemberId ? 1 : 2;
    return debts
      .map((debt, i) => ({ debt, i }))
      .sort((a, b) => rank(a.debt) - rank(b.debt) || a.i - b.i)
      .map(({ debt }) => debt);
  }, [expenses, myMemberId]);

  const getName = (memberId: string) =>
    memberMap.get(memberId) ?? t("group.members.unknownMember");

  const getAccount = (memberId: string): PaymentAccount | null => {
    const userId = currentGroup?.members?.find(
      (m) => m.memberId === memberId,
    )?.userId;
    return (userId && payees?.get(userId)) || null;
  };

  // 「自己要付、對方有收款方式」的列會多一顆查看按鈕
  const showsAccountButton = (debt: SettlementResult) =>
    debt.from === myMemberId && !!getAccount(debt.to);
  // 只要有一列有這顆按鈕，其他列就留同樣寬的空位，每一列的箭頭才會對齊
  const accountColumn = remainingDebts.some(showsAccountButton);

  // 有人要付錢給自己、自己又還沒設定帳號：列表底部提示一行，設定好就消失
  const showAccountSetup =
    canEdit &&
    !!user &&
    payees !== null &&
    !payees.has(user.uid) &&
    remainingDebts.some((d) => d.to === myMemberId);

  const copyText = async (text: string, message: string) => {
    const ok = await copyToClipboard(text);
    if (ok) showToast(message, "success");
    else {
      logger.warn("settle.copy", "複製失敗");
      showToast(t("common.error"), "error");
    }
    return ok;
  };

  /**
   * 結算一筆債務：在帳款中建立一筆「支付」記錄，
   * 付款人餘額增加、收款人餘額減少，自動抵銷原始債務。
   */
  const buildSettlementExpense = (debt: SettlementResult) => ({
    title: t("group.settle.settlementTitle", { to: getName(debt.to) }),
    amount: debt.amount,
    paidBy: debt.from,
    splitMode: "amount" as const,
    splits: [{ memberId: debt.to, amount: debt.amount }],
    description: t("group.settle.settlementNote", { from: getName(debt.from) }),
    imageUrl: null,
    date: new Date(),
    createdBy: user!.uid,
    isSettlement: true,
  });

  /**
   * 確認框開著的時候可能有人記了新帳，按下確認時用最新的帳務再算一次，
   * 建議已經變了就不寫入，免得照著舊畫面記下一筆對不上的結清。
   */
  const latestDebtKeys = () =>
    new Set(
      computeSettlementPlan(useGroupStore.getState().expenses).map(debtKey),
    );

  const handleMarkDone = async (debt: SettlementResult) => {
    if (!currentGroup || !user) return;
    if (!latestDebtKeys().has(debtKey(debt))) {
      showToast(t("group.settle.planChanged"), "warning");
      return;
    }
    try {
      await addExpense(currentGroup.groupId, buildSettlementExpense(debt));
    } catch (err) {
      logger.error("settle.markDone", "結算建立帳款失敗", err);
      showToast(t("common.error"), "error");
    }
  };

  const handleMarkAllDone = async () => {
    if (!currentGroup || !user) return;
    const latest = latestDebtKeys();
    if (
      latest.size !== remainingDebts.length ||
      remainingDebts.some((debt) => !latest.has(debtKey(debt)))
    ) {
      showToast(t("group.settle.planChanged"), "warning");
      return;
    }
    try {
      for (const debt of remainingDebts) {
        await addExpense(currentGroup.groupId, buildSettlementExpense(debt));
      }
      showToast(t("common.button.done"), "success");
    } catch (err) {
      logger.error("settle.markAllDone", "批次結算失敗", err);
      showToast(t("common.error"), "error");
    }
  };

  if (remainingDebts.length === 0) {
    return (
      <div className="mt-16 text-center text-base-content/40">
        <SparklesIcon className="mx-auto mb-3 h-12 w-12" />
        <p className="mt-2 font-semibold">{t("group.settle.noDebts")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 列表標題列：待結清筆數 + 全部標記完成 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-base-content/60">
          {t("group.settle.pendingCount", { count: remainingDebts.length })}
        </span>
        {canEdit && (
          <button
            className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 px-2"
            onClick={() => setShowMarkAllConfirm(true)}
          >
            {t("group.settle.markAllDone")}
          </button>
        )}
      </div>

      {/* 全部結清確認 Modal */}
      <ConfirmModal
        open={showMarkAllConfirm}
        title={t("group.settle.markAllDone")}
        message={t("group.settle.markAllDoneConfirm", {
          count: remainingDebts.length,
        })}
        confirmLabel={t("common.button.confirm")}
        cancelLabel={t("common.button.cancel")}
        onConfirm={() => {
          setShowMarkAllConfirm(false);
          handleMarkAllDone();
        }}
        onCancel={() => setShowMarkAllConfirm(false)}
      />

      {/* 單筆結清確認 Modal */}
      <ConfirmModal
        open={!!pendingDebt}
        title={t("group.settle.markDone")}
        message={
          pendingDebt
            ? t("group.settle.markDoneConfirm", {
                from: getName(pendingDebt.from),
                to: getName(pendingDebt.to),
                amount: pendingDebt.amount.toLocaleString(),
              })
            : ""
        }
        confirmLabel={t("common.button.confirm")}
        cancelLabel={t("common.button.cancel")}
        onConfirm={() => {
          if (pendingDebt) handleMarkDone(pendingDebt);
          setPendingDebt(null);
        }}
        onCancel={() => setPendingDebt(null)}
      />

      {/* 待結清列表：間距全部交給每一列的 py-3，
          不要再加 space-y，否則分隔線上下的留白會不對稱 */}
      <div className="flex flex-col">
        {remainingDebts.map((debt) => {
          const account = getAccount(debt.to);
          // 頭貼貼著名字、整列讀起來是一句話。付款人／收款人各佔固定比例，
          // 所以每一列的箭頭都落在同一個 x——長短名字混在一起時才不會歪。
          // 左 45／右 55：多數群組的名字都不長，對半切會讓箭頭離左邊的名字太遠。
          // 收款人那側留多一點，因為同一個人常常重複出現在收款側。
          // 箭頭右邊比左邊多留一點：右邊緊接著一顆頭貼，兩個實心的東西靠在
          // 一起，視覺上的間距會比實際數字看起來更窄。
          const summary = (
            <>
              <div className="grid grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.1fr)] items-center gap-x-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <UserAvatar
                    src={memberAvatarMap.get(debt.from) ?? null}
                    name={getName(debt.from)}
                    size="w-6"
                    textSize="text-[10px]"
                  />
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {getName(debt.from)}
                  </span>
                </div>
                <ArrowRightIcon className="mr-1 h-4 w-4 text-base-content/40" />
                <div className="flex min-w-0 items-center gap-1.5">
                  <UserAvatar
                    src={memberAvatarMap.get(debt.to) ?? null}
                    name={getName(debt.to)}
                    size="w-6"
                    textSize="text-[10px]"
                  />
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {getName(debt.to)}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-base font-bold text-warning">
                NT${debt.amount.toLocaleString()}
              </p>
            </>
          );

          return (
            <div
              key={`${debt.from}>${debt.to}`}
              className="flex items-center gap-3 py-3 border-b border-base-200 last:border-b-0"
            >
              {/* 收款人有設定收款方式：點這一列也能看；結清按鈕仍然只負責結清 */}
              {account ? (
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left transition-opacity active:opacity-60"
                  onClick={() => setTransferDebt(debt)}
                >
                  {summary}
                </button>
              ) : (
                <div className="flex-1 min-w-0">{summary}</div>
              )}

              {/* 查看收款方式放在結清旁邊，跟結清一樣是「動作」而不是狀態標籤。
                  只放在「自己要付」的列：其他人用不到，放了只會讓整頁變吵 */}
              {showsAccountButton(debt) && account ? (
                <button
                  type="button"
                  className="btn-muted btn-sm btn-circle flex-shrink-0"
                  aria-label={t("group.settle.viewAccount")}
                  title={t("group.settle.viewAccount")}
                  onClick={() => setTransferDebt(debt)}
                >
                  {hasBankAccount(account) ? (
                    <LandmarkIcon className="h-4 w-4" />
                  ) : (
                    <WalletIcon className="h-4 w-4" />
                  )}
                </button>
              ) : (
                accountColumn && (
                  <span className="w-8 flex-shrink-0" aria-hidden="true" />
                )
              )}

              {canEdit && (
                <button
                  className="btn-theme-green btn-sm flex-shrink-0 gap-1 rounded-full px-3"
                  onClick={() => setPendingDebt(debt)}
                  title={t("group.settle.markDone")}
                >
                  <CheckIcon className="h-4 w-4" />
                  {t("group.settle.settleAction")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 跟新增帳務的「詳細資訊」同一種灰底區塊：跟上面有分隔線的列表分得開，
          整塊都可以點。只有「有人要付錢給自己、自己又還沒設定帳號」時出現 */}
      {showAccountSetup && (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-base-200 px-4 py-3 text-left text-sm transition-colors active:bg-base-300"
          onClick={() => navigate("/settings/profile")}
        >
          <span>
            <span className="font-medium">
              {t("group.settle.setupAccountLink")}
            </span>
            <span className="text-base-content/60">
              {t("group.settle.setupAccountRest")}
            </span>
          </span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-base-content/40" />
        </button>
      )}

      {transferDebt && (
        <TransferModal
          title={
            transferDebt.from === myMemberId
              ? t("group.settle.transferTo", { to: getName(transferDebt.to) })
              : t("group.settle.transferFromTo", {
                  from: getName(transferDebt.from),
                  to: getName(transferDebt.to),
                })
          }
          account={getAccount(transferDebt.to)}
          amount={transferDebt.amount}
          onCopy={copyText}
          onSettle={
            canEdit
              ? () => {
                  const debt = transferDebt;
                  setTransferDebt(null);
                  handleMarkDone(debt);
                }
              : undefined
          }
          onClose={() => setTransferDebt(null)}
        />
      )}
    </div>
  );
}

/**
 * 轉帳資訊：銀行帳號、金額各一列，右邊的按鈕複製純數字（只收 LINE Pay 的人只有金額）；
 * 底下是「已轉帳，結清」。跟 ConfirmModal 同一種 modal，
 * 對話框本身已經寫清楚付給誰、多少錢，所以結清不再多問一次。
 */
function TransferModal({
  title,
  account,
  amount,
  onCopy,
  onSettle,
  onClose,
}: {
  title: string;
  account: PaymentAccount | null;
  amount: number;
  onCopy: (text: string, message: string) => Promise<boolean>;
  onSettle?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  // 開著的時候對方把帳號刪了
  if (!account) return null;

  // 跟 ConfirmModal 一樣掛在 body：分頁切換動畫的 transform 會讓 fixed 定位錯位
  return createPortal(
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        {/* LINE Pay 在 LINE 裡選好友就能轉，沒有要複製的東西，寫在標題下面就好 */}
        {account.linePay && (
          <p className="mt-1 text-sm text-base-content/60">
            {hasBankAccount(account)
              ? t("group.settle.linePayAlso")
              : t("group.settle.linePayOnly")}
          </p>
        )}
        {/* 跟頁面上的列表一樣用分隔線分列，不再包一層卡片 */}
        <div className="mt-2 flex flex-col">
          {hasBankAccount(account) && (
            <CopyRow
              label={formatBank(account.bankCode)}
              value={formatAccountNumber(account.accountNumber)}
              copyLabel={t("group.settle.copyAccount")}
              onCopy={() =>
                onCopy(account.accountNumber, t("group.settle.accountCopied"))
              }
            />
          )}
          <CopyRow
            label={t("expense.amount")}
            value={`NT$${amount.toLocaleString()}`}
            copyLabel={t("group.settle.copyAmount")}
            onCopy={() => onCopy(String(amount), t("group.settle.amountCopied"))}
          />
        </div>
        <div className="modal-action">
          <button className="btn-white-soft" onClick={onClose}>
            {t("common.button.close")}
          </button>
          {onSettle && (
            <button className="btn-theme-green" onClick={onSettle}>
              {t("group.settle.paidSettle")}
            </button>
          )}
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>,
    document.body,
  );
}

/** 一列資訊＋右邊的複製鈕；複製成功後圖示短暫變成勾勾 */
function CopyRow({
  label,
  value,
  copyLabel,
  onCopy,
}: {
  label: string;
  value: string;
  copyLabel: string;
  onCopy: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex items-center gap-3 border-b border-base-200 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-base-content/50">{label}</p>
        <p className="mt-0.5 break-all text-lg font-semibold tabular-nums tracking-wide">
          {value}
        </p>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-circle shrink-0 text-base-content/60"
        aria-label={copyLabel}
        onClick={async () => {
          if (await onCopy()) setCopied(true);
        }}
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-primary" />
        ) : (
          <CopyIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function debtKey(debt: SettlementResult): string {
  return `${debt.from}>${debt.to}:${debt.amount}`;
}
