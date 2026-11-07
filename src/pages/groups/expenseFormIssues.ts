import type { TFunction } from "i18next";
import type { FormIssue } from "@/hooks/useSubmitGuard";

export type ExpenseField = "title" | "amount" | "paidBy" | "split";
export type SplitMode = "equal" | "amount" | "percent";

interface ExpenseFormState {
  title: string;
  amountNum: number;
  paidBy: string;
  splitMode: SplitMode;
  selectedCount: number;
  splitTotal: number;
  savedSplitCount: number;
  percentTotal: number;
}

/** 新增／編輯群組帳務共用的必填檢查，依畫面由上到下的順序排列（toast 只說第一個） */
export function getExpenseFormIssues(
  s: ExpenseFormState,
  t: TFunction,
): FormIssue<ExpenseField>[] {
  const issues: FormIssue<ExpenseField>[] = [];
  if (!s.title.trim()) {
    issues.push({ field: "title", message: t("expense.validation.title") });
  }
  // 依金額分帳時金額由每人金額加總，沒填的問題歸在分帳對象那一欄
  if (s.splitMode !== "amount" && s.amountNum <= 0) {
    issues.push({ field: "amount", message: t("expense.validation.amount") });
  }
  if (!s.paidBy) {
    issues.push({ field: "paidBy", message: t("expense.validation.paidBy") });
  }

  if (s.selectedCount === 0) {
    issues.push({
      field: "split",
      message: t("expense.validation.splitMembers"),
    });
  } else if (s.splitMode === "amount" && s.amountNum <= 0) {
    issues.push({
      field: "split",
      message: t("expense.validation.splitAmounts"),
    });
  } else if (
    s.splitMode === "percent" &&
    s.amountNum > 0 &&
    s.percentTotal !== 100
  ) {
    issues.push({
      field: "split",
      message: t("expense.validation.percent", { percent: s.percentTotal }),
    });
  } else if (
    s.amountNum > 0 &&
    (s.savedSplitCount === 0 || s.splitTotal !== s.amountNum)
  ) {
    issues.push({ field: "split", message: t("expense.validation.mismatch") });
  }
  return issues;
}
