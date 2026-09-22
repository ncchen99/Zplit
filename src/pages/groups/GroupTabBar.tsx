import { useLayoutEffect, useRef, useState } from "react";
import {
  useSwipeProgress,
  type SwipeProgressStore,
} from "@/components/ui/swipeProgress";

interface TabItem {
  key: string;
  label: string;
}

interface GroupTabBarProps {
  tabs: TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  progress: SwipeProgressStore;
  /** 資料還沒載入時只顯示外觀 */
  disabled?: boolean;
}

interface Metric {
  left: number;
  width: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 群組分頁的頁籤列。底線不是 daisyUI 的 tab-active，而是自己畫的一條，
 * 這樣左右拖曳內容時底線與文字顏色可以即時跟著手指移動。
 */
export function GroupTabBar({
  tabs,
  activeKey,
  onSelect,
  progress,
  disabled = false,
}: GroupTabBarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const swipe = useSwipeProgress(progress);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const base = list.getBoundingClientRect();
      setMetrics(
        [...list.querySelectorAll<HTMLElement>("[role=tab]")].map((tab) => {
          const rect = tab.getBoundingClientRect();
          return { left: rect.left - base.left, width: rect.width };
        }),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    // 字型載入完會改變頁籤寬度，載入完成後再量一次
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [tabs]);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === activeKey),
  );
  const position = Math.min(
    tabs.length - 1,
    Math.max(0, swipe.dragging ? swipe.index : activeIndex),
  );

  const from = Math.min(Math.floor(position), metrics.length - 1);
  const to = Math.min(from + 1, metrics.length - 1);
  const ratio = position - from;
  const indicator =
    metrics.length > 0 && from >= 0
      ? {
          left: lerp(metrics[from].left, metrics[to].left, ratio),
          width: lerp(metrics[from].width, metrics[to].width, ratio),
        }
      : null;

  return (
    <div className="shrink-0 px-4">
      {/* 不用 tabs-border：daisyUI 會依 aria-selected 自己畫一條固定的底線，
          會和下面這條跟著手指移動的底線重疊 */}
      <div ref={listRef} role="tablist" className="tabs relative">
        {tabs.map((tab, i) => {
          const weight = Math.max(0, 1 - Math.abs(i - position));
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={tab.key === activeKey}
              // daisyUI 的 .tabs 會 flex-wrap，字一長整列就掉到第二行。
              // 四格等寬 + nowrap，不管哪個語言都維持單行。
              className="tab min-w-0 flex-1 px-1 whitespace-nowrap"
              disabled={disabled}
              onClick={() => onSelect(tab.key)}
              style={{
                color: `color-mix(in oklab, var(--color-primary) ${weight * 100}%, var(--color-base-content))`,
                opacity: 0.6 + 0.4 * weight,
                transition: swipe.dragging
                  ? "none"
                  : "color 200ms ease-out, opacity 200ms ease-out",
              }}
            >
              {tab.label}
            </button>
          );
        })}

        {indicator && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full bg-primary"
            style={{
              width: indicator.width,
              transform: `translate3d(${indicator.left}px, 0, 0)`,
              transition: swipe.dragging
                ? "none"
                : "transform 260ms cubic-bezier(0.22, 0.8, 0.22, 1), width 260ms cubic-bezier(0.22, 0.8, 0.22, 1)",
            }}
          />
        )}
      </div>
    </div>
  );
}
