import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGroupStore } from "@/store/groupStore";
import {
  computeBalances,
  computeSettlements,
  type SettlementResult,
} from "@/lib/algorithm/settlement";
import { addExpense } from "@/services/expenseService";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { logger } from "@/utils/logger";
import {
  ArrowRight as ArrowRightIcon,
  Sparkles as SparklesIcon,
  Check as CheckIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export function SettleTab() {
  const { t } = useTranslation();
  const expenses = useGroupStore((s) => s.expenses);
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [pendingDebt, setPendingDebt] = useState<SettlementResult | null>(null);

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

  /**
   * 剩餘待結清債務：直接從帳款（含已建立的結算帳款）計算。
   * 結算動作會建立一筆抵銷帳款，使餘額歸零，此處自動反映最新狀態。
   */
  const remainingDebts = useMemo(() => {
    if (!expenses.length) return [];
    return computeSettlements(computeBalances(expenses));
  }, [expenses]);

  const getName = (memberId: string) =>
    memberMap.get(memberId) ?? t("group.members.unknownMember");

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
  });

  const handleMarkDone = async (debt: SettlementResult) => {
    if (!currentGroup || !user) return;
    try {
      await addExpense(currentGroup.groupId, buildSettlementExpense(debt));
    } catch (err) {
      logger.error("settle.markDone", "結算建立帳款失敗", err);
      showToast(t("common.error"), "error");
    }
  };

  const handleMarkAllDone = async () => {
    if (!currentGroup || !user) return;
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
        <button
          className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 px-2"
          onClick={() => setShowMarkAllConfirm(true)}
        >
          {t("group.settle.markAllDone")}
        </button>
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

      {/* 待結清列表 */}
      <div className="space-y-3">
        {remainingDebts.map((debt, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-3 border-b border-base-200 last:border-b-0"
          >
            <UserAvatar
              src={memberAvatarMap.get(debt.from) ?? null}
              name={getName(debt.from)}
              size="w-9"
            />
            <ArrowRightIcon className="h-4 w-4 text-base-content/40 flex-shrink-0" />
            <UserAvatar
              src={memberAvatarMap.get(debt.to) ?? null}
              name={getName(debt.to)}
              size="w-9"
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {t("group.settle.transfer", {
                  from: getName(debt.from),
                  to: getName(debt.to),
                })}
              </p>
              <p className="text-base font-bold text-warning">
                NT${debt.amount.toLocaleString()}
              </p>
            </div>

            <div className="flex-shrink-0">
              <button
                className="btn-theme-green btn-sm btn-circle"
                onClick={() => setPendingDebt(debt)}
                title={t("group.settle.markDone")}
              >
                <CheckIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
