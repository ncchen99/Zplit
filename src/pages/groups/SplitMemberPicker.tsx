import { useTranslation } from "react-i18next";
import { Check as CheckIcon } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { GroupMember } from "@/store/groupStore";

interface SplitMemberPickerProps {
  /** 顯示順序即為傳入順序（呼叫端負責把自己排第一） */
  members: GroupMember[];
  selectedMemberIds: string[];
  onToggle: (memberId: string) => void;
  /** 每人分到多少；金額還沒填時傳 0，摘要就只顯示人數 */
  perPersonAmount: number;
}

/**
 * 平均分帳的分帳對象選取：一個圓角容器包住兩欄格子，格與格之間只用分隔線，
 * 不讓每個人各自帶一顆有邊框的按鈕——九人群組時那些邊框會吃掉太多高度。
 *
 * 外框和內部格線都用 `border-field-line` + `rounded-field`，跟同一張表單上的
 * input、select 完全一致（同色、同 1px）。之前用 base-300／base-200 +
 * rounded-2xl，在深色主題下框色比底色還暗（input 的框是偏白的），圓角又比
 * 隔壁大一倍，看起來就像另一個元件。
 *
 * 選中只靠底色，不做格線或外框的高亮：高亮在相鄰兩格都選中時會變得很雜。
 *
 * 勾記號疊在頭貼右下角而不是佔掉右側一欄：右側那一欄會壓縮名字寬度，
 * 而名字正是使用者用來確認「選的是不是這個人」的東西。
 */
export function SplitMemberPicker({
  members,
  selectedMemberIds,
  onToggle,
  perPersonAmount,
}: SplitMemberPickerProps) {
  const { t } = useTranslation();
  const selectedCount = members.filter((m) =>
    selectedMemberIds.includes(m.memberId),
  ).length;

  return (
    <div className="mb-3 overflow-hidden rounded-field border border-field-line bg-base-100">
      <div className="grid grid-cols-2">
        {members.map((m, i) => {
          const isSelected = selectedMemberIds.includes(m.memberId);
          // 奇數人數時最後一格跨滿整列，表格才不會缺一角
          const isWideTail =
            i === members.length - 1 && members.length % 2 === 1;
          return (
            <button
              key={m.memberId}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(m.memberId)}
              // 不要 transition：底色要在手指按下的當下就出現，淡入會讓人
              // 以為沒點到。touch-manipulation 拿掉行動瀏覽器的點擊延遲。
              className={`flex min-h-12 touch-manipulation items-center gap-2 border-b border-field-line px-3 py-2 text-left active:bg-base-200/50 ${
                isWideTail ? "col-span-2" : "border-r even:border-r-0"
              } ${isSelected ? "bg-split-fill" : ""}`}
            >
              <div className="relative flex-shrink-0">
                <UserAvatar
                  src={m.avatarUrl}
                  name={m.displayName}
                  size="w-8"
                  textSize="text-xs"
                  bgClass="bg-base-300 text-base-content"
                />
                {isSelected && (
                  // 描邊跟著格子的底色，不是 base-100——勾勾疊在已經上色的
                  // 格子上，用 base-100 會在周圍留一圈灰暈
                  <span className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-2 ring-split-fill">
                    <CheckIcon
                      className="h-2.5 w-2.5 text-primary-content"
                      strokeWidth={3}
                    />
                  </span>
                )}
              </div>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  isSelected
                    ? "font-medium text-base-content"
                    : "text-base-content/70"
                }`}
              >
                {m.displayName}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <span className="text-base-content/60">
          {t("expense.splitSummary.count", { count: selectedCount })}
        </span>
        {selectedCount > 0 && perPersonAmount > 0 && (
          <span className="font-medium text-base-content/80">
            {t("expense.splitSummary.each", {
              amount: perPersonAmount.toLocaleString(),
            })}
          </span>
        )}
      </div>
    </div>
  );
}
