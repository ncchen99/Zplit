import { useRef } from "react";
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

  // 奇數人數時最後一格只佔左半邊，摘要補上右半邊把那一列填滿；
  // 偶數人數時摘要自己佔一整列。讓最後一個人維持正常格寬，他才不會
  // 因為右邊空著而看起來偏左——即使他的起始位置和上面那些格子一樣。
  const summaryInLastRow = members.length % 2 === 1;

  /**
   * click 要等手指離開螢幕才觸發，所以「按下去」到「上色」之間隔著整個
   * 按壓的時間，手感上就是延遲。改成在 pointerdown 當下就切換，瀏覽器
   * 判定這其實是捲動手勢時會送出 pointercancel，那時再把剛才的切換收回。
   * pressedRef 同時讓後續的 click 知道這一下已經處理過，不要切第二次；
   * 鍵盤的 Enter／Space 沒有 pointer 事件，會正常落到 click。
   */
  const pressedRef = useRef<string | null>(null);

  const handlePointerDown = (memberId: string) => {
    pressedRef.current = memberId;
    onToggle(memberId);
  };

  const handlePointerCancel = () => {
    const memberId = pressedRef.current;
    pressedRef.current = null;
    if (memberId) onToggle(memberId);
  };

  const handleClick = (memberId: string) => {
    if (pressedRef.current === memberId) {
      pressedRef.current = null;
      return;
    }
    onToggle(memberId);
  };

  return (
    <div className="mb-3 overflow-hidden rounded-field border border-field-line bg-base-100">
      <div className="grid grid-cols-2">
        {members.map((m, i) => {
          const isSelected = selectedMemberIds.includes(m.memberId);
          // 最後一列的下面已經沒有東西了，再畫 border-b 會和容器外框疊成雙線
          const inLastRow = summaryInLastRow && i === members.length - 1;
          return (
            <button
              key={m.memberId}
              type="button"
              aria-pressed={isSelected}
              onPointerDown={() => handlePointerDown(m.memberId)}
              onPointerCancel={handlePointerCancel}
              onClick={() => handleClick(m.memberId)}
              // 不要 transition，也不要 active: 的按壓底色。切換已經發生在
              // pointerdown，格子自己變色就是最直接的回饋；再疊一層
              // active:bg-base-200/50 反而會因為 :active 的特異性蓋掉
              // bg-split-fill，手指按著的時候看到的是灰色，放開才「出現」
              // 綠色——那不是延遲，是被蓋住。實機用 CSS.forcePseudoState
              // 量過：按住時背景是 oklab(0.280 … / 0.5)，不是該有的綠。
              className={`flex min-h-12 touch-manipulation items-center gap-2 px-3 py-2 text-left ${
                inLastRow ? "" : "border-b border-field-line"
              } ${i % 2 === 0 ? "border-r border-field-line" : ""} ${
                isSelected ? "bg-split-fill" : ""
              }`}
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

        {/* 摘要也是格子之一，交給 grid 自己排：奇數時它自然落在最後一列的
            右半邊，偶數時跨滿一整列。半格放不下就換行靠右，不會撐開列高。 */}
        <div
          className={`flex items-center px-3 py-2 text-xs ${
            summaryInLastRow
              ? "flex-wrap justify-end"
              : "col-span-2 justify-between"
          }`}
        >
          <span className="text-base-content/60">
            {t("expense.splitSummary.count", { count: selectedCount })}
          </span>
          {selectedCount > 0 && perPersonAmount > 0 && (
            <span className="font-medium text-base-content/80">
              {/* 擠在同半格時用一條分隔線斷開——人數和金額是兩件事，
                  只隔一個空格會讀成一串。分隔線包在金額的 span 裡，
                  半格放不下而換行時它會跟著金額一起走到第二行。
                  偶數人數時摘要獨佔整列，左右已經拉開就不需要。 */}
              {summaryInLastRow && (
                <span className="mx-1.5 text-base-content/30">|</span>
              )}
              {t("expense.splitSummary.each", {
                amount: perPersonAmount.toLocaleString(),
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
