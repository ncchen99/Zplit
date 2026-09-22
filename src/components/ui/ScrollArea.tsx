import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** 各頁最後停的捲動位置。只留在記憶體：重新整理本來就該從頭看起。 */
const savedScrollTops = new Map<string, number>();

/** 還原時等資料把內容撐回原本高度的上限，逾時就停在當下捲得到的位置 */
const RESTORE_TIMEOUT_MS = 800;

interface ScrollAreaProps {
  children: ReactNode;
  /** 套在實際捲動容器上的樣式，通常是 padding */
  className?: string;
  /** 這個值改變時捲回頂端（例如切換分頁） */
  resetKey?: string;
  /**
   * 記住捲動位置的識別碼（例如 `group:<groupId>:summary`）。
   * 點進子頁再返回時整頁會重新掛載，有這個值才捲得回原本看到的地方。
   * 與 resetKey 互斥，不要同時給。
   */
  restoreKey?: string;
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
  restoreKey,
}: ScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  // 還原期間內容可能還沒載回來，這時的 scrollTop 是被高度夾住的值，不能存回去
  const restoringRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setIsScrolled(el.scrollTop > 0);
    if (restoreKey && !restoringRef.current) {
      savedScrollTops.set(restoreKey, el.scrollTop);
    }
  }, [restoreKey]);

  // 捲回頂端後瀏覽器會補一個 scroll 事件，isScrolled 由 handleScroll 更新
  useEffect(() => {
    if (resetKey === undefined) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [resetKey]);

  // 從子頁返回時捲回原本的位置。清單資料常常是重新掛載後才補上的，
  // 內容還沒長回原本高度前 scrollTop 會被夾住，所以要一直補到捲得到為止
  // （或使用者自己動了手、逾時為止）。在 layout effect 裡做，畫面不會先閃一下頂端。
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !restoreKey) return;

    const target = savedScrollTops.get(restoreKey) ?? 0;
    if (target <= 0) return;

    restoringRef.current = true;
    const deadline = Date.now() + RESTORE_TIMEOUT_MS;
    let frame = 0;

    const stop = () => {
      if (!restoringRef.current) return;
      restoringRef.current = false;
      cancelAnimationFrame(frame);
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchstart", stop);
    };

    const step = () => {
      el.scrollTop = target;
      if (el.scrollTop >= target - 1 || Date.now() > deadline) {
        stop();
        return;
      }
      frame = requestAnimationFrame(step);
    };

    // 使用者自己開始捲了就別再跟他搶
    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("touchstart", stop, { passive: true });
    step();

    return stop;
  }, [restoreKey]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`h-full overflow-y-auto overscroll-contain ${className}`}
      >
        {children}
      </div>

      {/* 固定區與內容的交界漸層，捲動後才出現 */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-base-100 to-transparent transition-opacity duration-200 ${
          isScrolled ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
