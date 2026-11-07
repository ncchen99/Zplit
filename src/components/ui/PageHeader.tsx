import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowLeft as ArrowLeftIcon } from "lucide-react";

interface PageHeaderProps {
  title: ReactNode;
  onBack: () => void;
  rightAction?: ReactNode;
  sticky?: boolean;
}

interface HeaderIconButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "default" | "primary";
  children: ReactNode;
}

export function HeaderIconButton({
  onClick,
  disabled,
  loading,
  tone = "default",
  children,
}: HeaderIconButtonProps) {
  const toneClass =
    tone === "primary" ? "text-base-content/50" : "text-base-content/50";

  return (
    <button
      className={`btn btn-ghost btn-sm btn-circle ${toneClass} hover:text-base-content/50 [&>svg]:h-5 [&>svg]:w-5 disabled:opacity-30 disabled:cursor-not-allowed`}
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        children
      )}
    </button>
  );
}

interface HeaderSubmitButtonProps {
  onClick: () => void;
  /** 必填欄位都填好了。沒填好時看起來是停用的，但仍可點，點了由頁面提示哪一欄沒填 */
  ready: boolean;
  loading?: boolean;
  children: ReactNode;
}

/**
 * 表單頁右上角的「完成」：有底色的文字按鈕，比圖示鈕好找。
 * 樣式跟群組列表標頭的「新增」一樣（btn-theme-green btn-sm）；實心的 btn-primary 膠囊
 * 只留給浮動的「新增帳務」，別處用了會像另一顆新增鍵。沒填好時是 btn-theme-green 的
 * 停用樣式（偏灰的淡綠，由 aria-disabled 觸發，見 index.css），仍可點。
 */
export function HeaderSubmitButton({
  onClick,
  ready,
  loading,
  children,
}: HeaderSubmitButtonProps) {
  return (
    <button
      type="button"
      // 看起來 36px 高、14px 字（btn-sm 的 12px 擺在 18px 粗體標題旁太小），
      // 但 -my-0.5 讓它在版面上只佔 32px：跟其他頁的圖示鈕一樣，標頭維持 56px 不變高
      className="btn-theme-green btn-sm -my-0.5 h-9 min-h-9 px-4 text-sm"
      onClick={onClick}
      disabled={loading}
      aria-disabled={!ready}
    >
      {loading ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        children
      )}
    </button>
  );
}

export function PageHeader({
  title,
  onBack,
  rightAction,
  sticky = true,
}: PageHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const headerRow = (
    // 左右兩欄等寬（1fr），標題才會置中；右邊放比較寬的按鈕（例如「完成」）時兩欄一起變寬
    <div className="grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center px-4 pt-4 pb-2 bg-base-100">
      <div className="flex justify-start">
        <button
          className="btn btn-ghost btn-sm btn-circle text-base-content/50 hover:text-base-content/50 [&>svg]:h-5 [&>svg]:w-5"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeftIcon />
        </button>
      </div>

      <h1 className="min-w-0 truncate px-2 text-center text-lg font-bold">
        {title}
      </h1>

      <div className="flex justify-end">
        {rightAction ?? <span className="h-9 w-9" aria-hidden="true" />}
      </div>
    </div>
  );

  // 放在不捲動的固定區塊裡時，交界處的漸層由下方的 ScrollArea 負責
  if (!sticky) {
    return <div className="relative z-10 shrink-0">{headerRow}</div>;
  }

  return (
    <>
      {/* Sentinel: 1px tall, -1px margin so it doesn't affect layout.
          When it scrolls out of view, isScrolled becomes true. */}
      <div ref={sentinelRef} className="h-px -mb-px" aria-hidden="true" />
      <div className="relative z-10 sticky top-0">
        {headerRow}
        {/* Gradient fade below header, only visible after scrolling */}
        <div
          className={`absolute left-0 right-0 h-4 bg-gradient-to-b from-base-100 to-transparent pointer-events-none transition-opacity duration-200 ${isScrolled ? "opacity-100" : "opacity-0"}`}
        />
      </div>
    </>
  );
}
