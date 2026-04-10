import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useGroupStore } from "@/store/groupStore";
import {
  computeBalances,
  computeSettlements,
} from "@/lib/algorithm/settlement";
import {
  ChevronDown as ChevronDownIcon,
  FileText as DocumentTextIcon,
  RotateCw as ArrowPathIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { DebtTreemap, type DebtEntry } from "@/components/ui/DebtTreemap";
import type { GroupMember } from "@/store/groupStore";

interface SummaryTabProps {
  onNavigateSettle?: () => void;
}

export function SummaryTab({ onNavigateSettle }: SummaryTabProps) {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<"date" | "amount" | "name">("date");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const expenses = useGroupStore((s) => s.expenses);
  const settlements = useGroupStore((s) => s.settlements);
  const currentGroup = useGroupStore((s) => s.currentGroup);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    currentGroup?.members?.forEach((m) => map.set(m.memberId, m.displayName));
    return map;
  }, [currentGroup]);

  const memberAvatarMap = useMemo(() => {
    const map = new Map<string, string | null>();
    currentGroup?.members?.forEach((m) => map.set(m.memberId, m.avatarUrl));
    return map;
  }, [currentGroup]);

  const memberFullMap = useMemo(() => {
    const map = new Map<string, GroupMember>();
    currentGroup?.members?.forEach((m) => map.set(m.memberId, m));
    return map;
  }, [currentGroup]);

  // Build DebtEntry[] for treemap — only negative balances (debtors),
  // adjusted for completed settlements
  const treemapData: DebtEntry[] = useMemo(() => {
    if (!expenses.length) return [];
    const balances = computeBalances(expenses);
    const debts = computeSettlements(balances);

    // Subtract completed settlements from the computed debts
    const completedSettlements = settlements.filter((s) => s.completed);
    const remainingDebts = debts
      .map((debt) => {
        const matching = completedSettlements.find(
          (s) =>
            s.from === debt.from &&
            s.to === debt.to &&
            s.amount === debt.amount,
        );
        if (matching) return { ...debt, amount: 0 };
        return debt;
      })
      .filter((d) => d.amount > 0);

    // Aggregate remaining debts per debtor (from)
    const debtorMap = new Map<string, number>();
    for (const d of remainingDebts) {
      debtorMap.set(d.from, (debtorMap.get(d.from) ?? 0) + d.amount);
    }

    return Array.from(debtorMap.entries())
      .map(([memberId, owed]) => ({
        memberId,
        name: memberMap.get(memberId) ?? memberId,
        avatarUrl: memberAvatarMap.get(memberId) ?? null,
        owed,
      }))
      .filter((d) => d.owed > 0)
      .sort((a, b) => b.owed - a.owed);
  }, [expenses, settlements, memberMap, memberAvatarMap]);

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      if (sortBy === "amount") {
        return b.amount - a.amount;
      }

      if (sortBy === "name") {
        return a.title.localeCompare(b.title, "zh-Hant");
      }

      const aTime = a.date?.seconds ?? 0;
      const bTime = b.date?.seconds ?? 0;
      return bTime - aTime;
    });
  }, [expenses, sortBy]);

  const getName = (memberId: string) => memberMap.get(memberId) ?? memberId;

  const handleSelectSort = (value: "date" | "amount" | "name") => {
    setSortBy(value);
    setShowSortMenu(false);
  };

  return (
    <div className="flex flex-col">
      {/* Top Block: Debt Treemap */}
      {treemapData.length > 0 && (
        <div className="pb-4 border-b border-base-200 mb-4">
          <DebtTreemap
            data={treemapData}
            formatAmount={(amount) => `-$${amount.toLocaleString()}`}
            onBlockClick={() => onNavigateSettle?.()}
          />
        </div>
      )}

      {/* Bottom Block: Expense Records */}
      {expenses.length === 0 ? (
        <div className="mt-16 text-center text-base-content/40">
          <DocumentTextIcon className="mx-auto mb-3 h-12 w-12" />
          <p>{t("group.summary.noExpenses")}</p>
          <p className="text-sm mt-1">{t("group.summary.addFirst")}</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-base-content/60">
              {t("group.summary.detailRecords")}
            </h3>
            <div className="relative">
              <button
                className="btn-white-soft btn-xs gap-1"
                onClick={() => setShowSortMenu((prev) => !prev)}
              >
                {sortBy === "date" && t("group.summary.sortByDate")}
                {sortBy === "amount" && t("group.summary.sortByAmount")}
                {sortBy === "name" && t("group.summary.sortByName")}
                <ChevronDownIcon className="h-3 w-3" />
              </button>
              {showSortMenu && (
                <ul className="absolute right-0 top-full z-50 mt-1 w-32 overflow-hidden rounded-xl border border-base-200 bg-base-100 py-1 shadow-lg">
                  <li>
                    <button
                      className={`flex w-full items-center rounded-none px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-base-200 active:bg-base-300 ${
                        sortBy === "date" ? "bg-base-200" : ""
                      }`}
                      onClick={() => handleSelectSort("date")}
                    >
                      {t("group.summary.sortByDate")}
                    </button>
                  </li>
                  <li>
                    <button
                      className={`flex w-full items-center rounded-none px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-base-200 active:bg-base-300 ${
                        sortBy === "amount" ? "bg-base-200" : ""
                      }`}
                      onClick={() => handleSelectSort("amount")}
                    >
                      {t("group.summary.sortByAmount")}
                    </button>
                  </li>
                  <li>
                    <button
                      className={`flex w-full items-center rounded-none px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-base-200 active:bg-base-300 ${
                        sortBy === "name" ? "bg-base-200" : ""
                      }`}
                      onClick={() => handleSelectSort("name")}
                    >
                      {t("group.summary.sortByName")}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            {sortedExpenses.map((expense) => {
              const payer = getName(expense.paidBy);
              const payerAvatar = memberAvatarMap.get(expense.paidBy) ?? null;
              const isRepeat =
                expense.repeat &&
                (expense.repeat as { type?: string }).type !== "none";
              const dateStr = expense.date?.seconds
                ? new Date(expense.date.seconds * 1000).toLocaleDateString()
                : "";
              const splitMembers = expense.splits
                .map((s) => memberFullMap.get(s.memberId))
                .filter(Boolean) as GroupMember[];

              return (
                <button
                  key={expense.expenseId}
                  className="flex items-center gap-3 py-3 border-b border-base-200 last:border-b-0 text-left active:bg-base-200 transition-colors w-full"
                  onClick={() =>
                    navigate(`/groups/${groupId}/expenses/${expense.expenseId}`)
                  }
                >
                  <UserAvatar src={payerAvatar} name={payer} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold truncate">{expense.title}</p>
                      {isRepeat && (
                        <ArrowPathIcon className="h-3.5 w-3.5 flex-shrink-0 text-base-content/50" />
                      )}
                    </div>
                    <p className="text-xs text-base-content/50">
                      {dateStr && <span className="mr-1">{dateStr}</span>}
                    </p>
                    <p className="text-xs text-base-content/50">
                      {t("expense.paidFor", { name: payer })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="font-bold text-warning">
                      NT${expense.amount.toLocaleString()}
                    </span>
                    {splitMembers.length > 0 && (
                      <AvatarGroup
                        items={splitMembers.map((m) => ({
                          id: m.memberId,
                          name: m.displayName,
                          avatarUrl: m.avatarUrl,
                        }))}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showSortMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSortMenu(false)}
        />
      )}
    </div>
  );
}
