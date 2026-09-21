import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import type { SwipeProgressStore } from "@/components/ui/swipeProgress";

const SETTLE_DURATION = 260;
const SETTLE_EASING = "cubic-bezier(0.22, 0.8, 0.22, 1)";
/** 鎖定手勢方向前要先移動的距離 */
const AXIS_LOCK_DISTANCE = 8;
/** 拖超過容器寬度的這個比例就換頁 */
const COMMIT_RATIO = 0.25;
/** 或是快速甩動（px / ms） */
const COMMIT_VELOCITY = 0.4;
/** 已在第一／最後一頁還繼續拖時的阻尼 */
const EDGE_RESISTANCE = 0.35;

interface Motion {
  /** offset 為 0 時位於畫面中央的頁面 */
  base: number;
  /** 相對 base 的水平位移（px） */
  offset: number;
  phase: "idle" | "drag" | "settle";
}

interface Gesture {
  /** 鎖定水平方向的那一刻的 X，之後的位移從這裡算起，避免 8px 的跳動 */
  originX: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  axis: "x" | "y" | null;
  width: number;
}

interface SwipeViewsProps {
  /** 目前頁面（受控） */
  index: number;
  count: number;
  /** 手勢換頁時回報，由外層決定要改網址還是改 state */
  onIndexChange: (index: number) => void;
  renderPage: (index: number) => ReactNode;
  /** 有傳就會即時回報滑動進度，讓 tab bar / nav bar 跟著動 */
  progress?: SwipeProgressStore;
  className?: string;
}

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (value: number, max: number) =>
  Math.min(max, Math.max(0, value));

/**
 * 手機用的左右滑動分頁：拖曳時頁面即時跟著手指走，放開後滑到定位。
 *
 * 兩個刻意的設計：
 * 1. 靜止時完全不留 transform——帶 transform 的祖先會變成 position:fixed 的
 *    包含區塊，頁面裡的 modal / ActionSheet 會因此錯位。
 * 2. 只有目前頁面（以及手勢進行中的左右鄰居）會渲染，其餘保持掛載但
 *    display:none，換頁不用重新載入資料。鄰居在 touchstart 才首次掛載，
 *    沒滑過的人不會付出多餘的訂閱／查詢成本。
 */
export function SwipeViews({
  index,
  count,
  onIndexChange,
  renderPage,
  progress,
  className = "",
}: SwipeViewsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState<Motion>({
    base: index,
    offset: 0,
    phase: "idle",
  });
  const motionRef = useRef(motion);
  motionRef.current = motion;

  const [mounted, setMounted] = useState<number[]>(() => [index]);
  const gestureRef = useRef<Gesture | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const lastIndexRef = useRef(index);

  const publish = (value: number, dragging: boolean) =>
    progress?.set(clamp(value, count - 1), dragging);

  const mount = (...indexes: number[]) => {
    setMounted((prev) => {
      const next = indexes.filter(
        (i) => i >= 0 && i < count && !prev.includes(i),
      );
      return next.length > 0 ? [...prev, ...next] : prev;
    });
  };

  const clearSettleTimer = () => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  };

  useEffect(() => clearSettleTimer, []);

  /** 先把畫面定在 fromOffset（不帶動畫），下一幀再滑回 0 */
  const settleTo = (target: number, fromOffset: number) => {
    clearSettleTimer();
    publish(target, false);
    if (fromOffset === 0 || prefersReducedMotion()) {
      setMotion({ base: target, offset: 0, phase: "idle" });
      return;
    }
    setMotion({ base: target, offset: fromOffset, phase: "drag" });
    requestAnimationFrame(() => {
      if (gestureRef.current?.axis === "x") return; // 使用者又開始拖了
      setMotion({ base: target, offset: 0, phase: "settle" });
      // transitionend 沒送到時的保險，否則 transform 會一直留著
      settleTimerRef.current = window.setTimeout(() => {
        setMotion((m) => (m.phase === "settle" ? { ...m, phase: "idle" } : m));
      }, SETTLE_DURATION + 80);
    });
  };

  // 外部（點分頁、按 nav、上一頁）改變 index：相鄰就補動畫，跨頁就直接跳
  useEffect(() => {
    if (index === lastIndexRef.current) return;
    const from = lastIndexRef.current;
    lastIndexRef.current = index;
    mount(index);
    if (motionRef.current.base === index) return; // 手勢已經自己換好了
    const width = rootRef.current?.clientWidth ?? 0;
    if (width === 0 || Math.abs(index - from) !== 1) {
      clearSettleTimer();
      publish(index, false);
      setMotion({ base: index, offset: 0, phase: "idle" });
      return;
    }
    mount(from);
    settleTo(index, (index - from) * width);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (count < 2 || e.touches.length !== 1) {
      gestureRef.current = null;
      return;
    }
    const touch = e.touches[0];
    const base = motionRef.current.base;
    mount(base - 1, base + 1);
    gestureRef.current = {
      originX: touch.clientX,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastTime: performance.now(),
      velocity: 0,
      axis: null,
      width: rootRef.current?.clientWidth ?? 0,
    };
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (gesture.axis === null) {
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      if (
        Math.abs(dx) < AXIS_LOCK_DISTANCE &&
        Math.abs(dy) < AXIS_LOCK_DISTANCE
      ) {
        return;
      }
      // 垂直手勢交給瀏覽器捲動（容器是 touch-action: pan-y）
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (gesture.axis === "y") return;
      gesture.originX = touch.clientX;
      clearSettleTimer();
    }
    if (gesture.axis !== "x") return;

    const now = performance.now();
    const elapsed = now - gesture.lastTime;
    if (elapsed > 0) {
      gesture.velocity = (touch.clientX - gesture.lastX) / elapsed;
      gesture.lastX = touch.clientX;
      gesture.lastTime = now;
    }

    const base = motionRef.current.base;
    const dx = touch.clientX - gesture.originX;
    const atEdge = (base === 0 && dx > 0) || (base === count - 1 && dx < 0);
    const offset = atEdge ? dx * EDGE_RESISTANCE : dx;
    const width = gesture.width || rootRef.current?.clientWidth || 1;
    publish(base - offset / width, true);
    setMotion({ base, offset, phase: "drag" });
  };

  const handleTouchEnd = () => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || gesture.axis !== "x") return;

    const { base, offset } = motionRef.current;
    const width = gesture.width || rootRef.current?.clientWidth || 1;
    const sameWay = Math.sign(gesture.velocity) === Math.sign(offset);
    const fast = Math.abs(gesture.velocity) > COMMIT_VELOCITY;
    // 往回甩就算已經拖很遠也留在原頁
    const commit =
      !(fast && !sameWay) &&
      ((fast && sameWay) || Math.abs(offset) > width * COMMIT_RATIO);
    const target = commit
      ? clamp(base + (offset < 0 ? 1 : -1), count - 1)
      : base;

    // 立刻把 base 換成目標頁（畫面位置補回去不動），再滑到定位
    if (target !== base) {
      mount(target);
      lastIndexRef.current = target;
      onIndexChange(target);
    }
    settleTo(target, offset + (target - base) * width);
  };

  const handleTransitionEnd = (e: ReactTransitionEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.propertyName !== "transform" || target.dataset.swipePage === undefined)
      return;
    clearSettleTimer();
    setMotion((m) => (m.phase === "settle" ? { ...m, phase: "idle" } : m));
  };

  // 拖曳過程中每個 touchmove 都會重畫這個元件；把頁面內容 memo 起來，
  // React 才會因為 element 參考相同而跳過各分頁的重新渲染。
  const pageNodes = useMemo(
    () => Array.from({ length: count }, (_, i) => renderPage(i)),
    [count, renderPage],
  );

  const { base, offset, phase } = motion;
  const moving = phase !== "idle";

  return (
    <div
      ref={rootRef}
      className={`relative min-h-0 flex-1 overflow-hidden ${className}`}
      style={{ touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onTransitionEnd={handleTransitionEnd}
    >
      {Array.from({ length: count }, (_, i) => {
        if (!mounted.includes(i)) return null;
        const visible = i === base || (moving && Math.abs(i - base) === 1);
        // 每頁自己是一個撐滿的 flex column，裡面的 ScrollArea（flex-1 min-h-0）
        // 才有確定的高度可以捲動
        const frame: CSSProperties = {
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
        };
        const style: CSSProperties = !visible
          ? { display: "none" }
          : moving
            ? {
                ...frame,
                transform: `translate3d(calc(${(i - base) * 100}% + ${offset}px), 0, 0)`,
                transition:
                  phase === "settle"
                    ? `transform ${SETTLE_DURATION}ms ${SETTLE_EASING}`
                    : undefined,
                willChange: "transform",
                pointerEvents: i === base ? undefined : "none",
              }
            : // 靜止時不留 transform，頁面裡的 fixed 元素才不會被當成相對定位
              frame;

        return (
          <div key={i} data-swipe-page="" style={style}>
            {pageNodes[i]}
          </div>
        );
      })}
    </div>
  );
}
