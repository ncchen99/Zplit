import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEventHandler,
} from "react";

interface ScrollAreaProps {
  children: ReactNode;
  /** 套在實際捲動容器上的樣式，通常是 padding */
  className?: string;
  /** 這個值改變時捲回頂端（例如切換分頁） */
  resetKey?: string;
  onTouchStart?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
}

/**
 * 固定標頭底下的捲動區。
 *
 * 標頭與內容同為 base-100、又沒有陰影，捲到一半時兩者會糊在一起，
 * 因此捲動後在交界處淡入一層漸層當作分層提示。
 */
export function ScrollArea({
  children,
  className = "",
  resetKey,
  onTouchStart,
  onTouchEnd,
}: ScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setIsScrolled(el.scrollTop > 0);
  }, []);

  // 捲回頂端後瀏覽器會補一個 scroll 事件，isScrolled 由 handleScroll 更新
  useEffect(() => {
    if (resetKey === undefined) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [resetKey]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`h-full overflow-y-auto overscroll-contain ${className}`}
      >
        {children}
      </div>

      {/* 固定區與內容的交界漸層，捲動後才出現 */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-base-100 to-transparent transition-opacity duration-200 ${
          isScrolled ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
