import { logger } from "@/utils/logger";

/**
 * 包裝 Firestore 寫入。
 *
 * Firestore 會先把寫入套用到本機快取並排入佇列，但回傳的 Promise 要等伺服器確認才 resolve。
 * 離線時若照常 await，畫面會一直停在「儲存中」。因此離線時不等待伺服器確認：
 * 資料已在本機生效（清單與即時監聽會立即反映），恢復連線後由 Firestore 自動同步。
 */
export function commitWrite<T>(write: Promise<T>): Promise<T | void> {
  if (typeof navigator === "undefined" || navigator.onLine) return write;

  write.catch((err) => {
    logger.error("firestore.offlineWrite", "離線寫入於恢復連線後同步失敗", err);
  });
  return Promise.resolve();
}
