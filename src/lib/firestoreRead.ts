import {
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from "firebase/firestore";
import { logger } from "@/utils/logger";

/**
 * - `default`：優先向伺服器讀取，離線時 Firestore 自動改讀本機快取
 * - `cache`：只讀本機 IndexedDB 快取（幾乎零延遲，資料可能過期或不存在）
 */
export type ReadSource = "default" | "cache";

export function readDocs<T = DocumentData>(
  q: Query<T>,
  source: ReadSource = "default",
): Promise<QuerySnapshot<T>> {
  return source === "cache" ? getDocsFromCache(q) : getDocs(q);
}

export function readDoc<T = DocumentData>(
  ref: DocumentReference<T>,
  source: ReadSource = "default",
): Promise<DocumentSnapshot<T>> {
  return source === "cache" ? getDocFromCache(ref) : getDoc(ref);
}

/** 預設判斷：陣列非空、物件非 null 才算「快取有資料」 */
function defaultHasData(data: unknown): boolean {
  if (Array.isArray(data)) return data.length > 0;
  return data != null;
}

/**
 * Stale-while-revalidate：先用本機快取立即渲染，再以伺服器結果覆蓋。
 * 快取沒有資料時不呼叫 apply（維持 skeleton），避免閃現「空清單」。
 * 伺服器結果一旦先到，較慢的快取結果會被忽略。
 */
export async function cacheThenServer<T>(
  load: (source: ReadSource) => Promise<T>,
  apply: (data: T, fromCache: boolean) => void,
  hasData: (data: T) => boolean = defaultHasData,
): Promise<void> {
  let serverApplied = false;

  const fromCache = load("cache")
    .then((data) => {
      if (!serverApplied && hasData(data)) apply(data, true);
    })
    .catch(() => {
      // 快取中沒有此資料（首次載入）— 等伺服器即可
    });

  try {
    const data = await load("default");
    serverApplied = true;
    apply(data, false);
  } catch (err) {
    logger.warn("firestore.cacheThenServer", "伺服器讀取失敗，保留快取資料", err);
    await fromCache;
    throw err;
  }
}
