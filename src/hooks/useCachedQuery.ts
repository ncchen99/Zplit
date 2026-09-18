import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { cacheThenServer, type ReadSource } from "@/lib/firestoreRead";
import { logger } from "@/utils/logger";

// 記憶體快取：切換分頁再回來時可同步取得上次的資料，完全不出現 skeleton
const memoryCache = new Map<string, unknown>();

interface Entry<T> {
  key: string | null;
  data: T | undefined;
  /** 伺服器結果（或失敗）已回來 */
  settled: boolean;
}

/**
 * 以 key 快取的資料載入：
 * 1. 記憶體中有上次結果 → 立即顯示
 * 2. 讀取 Firestore 本機快取（IndexedDB）→ 通常數十毫秒內顯示
 * 3. 向伺服器重新驗證 → 以最新資料覆蓋
 * `key` 為 null 時不載入（例如使用者尚未登入）。
 */
export function useCachedQuery<T>(
  key: string | null,
  load: (source: ReadSource) => Promise<T>,
  hasData?: (data: T) => boolean,
) {
  const [entry, setEntry] = useState<Entry<T>>(() => ({
    key,
    data: key ? (memoryCache.get(key) as T | undefined) : undefined,
    settled: false,
  }));
  const [version, setVersion] = useState(0);

  // key 改變時，在 render 階段直接切到新 key 的記憶體快取
  const current: Entry<T> =
    entry.key === key
      ? entry
      : {
          key,
          data: key ? (memoryCache.get(key) as T | undefined) : undefined,
          settled: false,
        };

  const runLoad = useEffectEvent((source: ReadSource) => load(source));
  const runHasData = useEffectEvent((data: T) =>
    hasData ? hasData(data) : undefined,
  );

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    const apply = (data: T, fromCache: boolean) => {
      if (cancelled) return;
      memoryCache.set(key, data);
      setEntry((prev) => ({
        key,
        data,
        settled: fromCache ? prev.key === key && prev.settled : true,
      }));
    };

    const check = (data: T) => {
      const custom = runHasData(data);
      if (custom !== undefined) return custom;
      return Array.isArray(data) ? data.length > 0 : data != null;
    };

    cacheThenServer(runLoad, apply, check).catch((err) => {
      logger.error("useCachedQuery", "載入資料失敗", { key, err });
      if (cancelled) return;
      setEntry((prev) => ({
        key,
        data: prev.key === key ? prev.data : undefined,
        settled: true,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  /** 樂觀更新：直接改寫目前資料（例如新增後立即反映） */
  const mutate = useCallback(
    (updater: (prev: T | undefined) => T) => {
      if (!key) return;
      setEntry((prev) => {
        const data = updater(prev.key === key ? prev.data : undefined);
        memoryCache.set(key, data);
        return { key, data, settled: prev.key === key && prev.settled };
      });
    },
    [key],
  );

  return {
    data: current.data,
    /** 沒有任何可顯示的資料、且仍在等待中 → 顯示 skeleton */
    loading: current.data === undefined && !current.settled,
    /** 背景重新驗證中（已有資料顯示） */
    refreshing: !current.settled,
    reload,
    mutate,
  };
}

/** 登出時清除，避免下一位使用者看到前一位的資料 */
export function clearQueryMemoryCache() {
  memoryCache.clear();
}
