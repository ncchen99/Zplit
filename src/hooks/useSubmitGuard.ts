import { useState } from "react";
import { useUIStore } from "@/store/uiStore";

export interface FormIssue<F extends string> {
  field: F;
  message: string;
}

/**
 * 表單送出前的必填檢查：按鈕永遠可以按，沒填好時跳 toast 說第一個沒填的欄位，
 * 並從這次起在每個沒填好的欄位下方標出提示（還沒按過送出前不標，免得一進頁面就整片紅）。
 */
export function useSubmitGuard<F extends string>(issues: FormIssue<F>[]) {
  const showToast = useUIStore((s) => s.showToast);
  const [attempted, setAttempted] = useState(false);

  const errorOf = (field: F): string | null =>
    attempted ? (issues.find((i) => i.field === field)?.message ?? null) : null;

  /** 回傳 true 代表可以送出 */
  const guard = (): boolean => {
    if (issues.length === 0) return true;
    setAttempted(true);
    showToast(issues[0].message, "warning");
    return false;
  };

  return { ready: issues.length === 0, errorOf, guard };
}
