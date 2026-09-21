import { useState, useSyncExternalStore } from "react";

export interface SwipeProgress {
  /** 目前位置，拖曳時是小數（1.4 = 在第 2、3 頁之間） */
  index: number;
  /** 手指正拖著：指示器要即時跟隨，不要再加轉場動畫 */
  dragging: boolean;
}

export interface SwipeProgressStore {
  get: () => SwipeProgress;
  set: (index: number, dragging: boolean) => void;
  subscribe: (onChange: () => void) => () => void;
}

/**
 * 給 tab bar / nav bar 訂閱滑動進度用的小型外部 store。
 *
 * 不用 state 往上傳，是因為拖曳時每一幀都會更新；讓父層重新渲染會連帶
 * 重畫所有分頁內容。改成只有指示器元件訂閱，拖曳期間就只重畫那一小塊。
 */
export function useSwipeProgressStore(initialIndex: number): SwipeProgressStore {
  const [store] = useState<SwipeProgressStore>(() => {
    let value: SwipeProgress = { index: initialIndex, dragging: false };
    const listeners = new Set<() => void>();
    return {
      get: () => value,
      set: (index, dragging) => {
        if (value.index === index && value.dragging === dragging) return;
        value = { index, dragging };
        listeners.forEach((fn) => fn());
      },
      subscribe: (onChange) => {
        listeners.add(onChange);
        return () => listeners.delete(onChange);
      },
    };
  });
  return store;
}

export function useSwipeProgress(store: SwipeProgressStore): SwipeProgress {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
