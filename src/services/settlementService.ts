import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/utils/logger";

/**
 * 清除群組中殘留的 completed: false 結算記錄（舊資料相容性清理）。
 *
 * 新架構下結算記錄只會在使用者主動點擊結清時建立（始終 completed: true）。
 * 此函式僅用於清理舊版本遺留的 incomplete 記錄，不再主動建立任何記錄。
 */
export async function cleanupStaleSettlements(groupId: string): Promise<void> {
  try {
    const settlementsRef = collection(db, `groups/${groupId}/settlements`);
    const staleSnap = await getDocs(
      query(settlementsRef, where("completed", "==", false)),
    );

    if (staleSnap.empty) return;

    const batch = writeBatch(db);
    staleSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    logger.info("settlement.cleanup", "清理舊版 incomplete 結算記錄", {
      groupId,
      count: staleSnap.size,
    });
  } catch (err) {
    logger.error("settlement.cleanup", "清理結算記錄失敗", { groupId, err });
  }
}
