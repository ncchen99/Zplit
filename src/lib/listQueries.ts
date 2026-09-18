import type { Group } from "@/store/groupStore";
import { backfillInviteCodes, getUserGroups } from "@/services/groupService";
import { getGroupExpenses } from "@/services/expenseService";
import { computeBalances } from "@/lib/algorithm/settlement";
import {
  computePersonalNetAmount,
  getContacts,
  getPersonalExpenses,
  type PersonalContact,
} from "@/services/personalLedgerService";
import type { ReadSource } from "@/lib/firestoreRead";
import { logger } from "@/utils/logger";

export function getTimestampMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export interface GroupsWithNet {
  groups: Group[];
  netMap: Record<string, number>;
}

/**
 * 讀取使用者的群組（依最近記帳時間排序），並計算前 `netLimit` 個群組中自己的淨額。
 */
export async function loadGroupsWithNet(
  userId: string,
  source: ReadSource,
  netLimit = Infinity,
): Promise<GroupsWithNet> {
  const myGroups = await getUserGroups(userId, source);
  const groups = [...myGroups].sort(
    (a, b) =>
      getTimestampMs(b.lastExpenseAt ?? b.updatedAt) -
      getTimestampMs(a.lastExpenseAt ?? a.updatedAt),
  );

  if (source === "default") {
    backfillInviteCodes(myGroups).catch((err) => {
      logger.error("groups.backfill", "補建 inviteCode 失敗", err);
    });
  }

  const netEntries = await Promise.all(
    groups.slice(0, netLimit).map(async (g) => {
      const myMember = g.members?.find((m) => m.userId === userId);
      if (!myMember) return [g.groupId, 0] as const;
      try {
        const exps = await getGroupExpenses(g.groupId, source);
        const mine = computeBalances(exps).find(
          (b) => b.memberId === myMember.memberId,
        );
        return [g.groupId, mine?.amount ?? 0] as const;
      } catch (err) {
        if (source === "default") {
          logger.error("groups.net", "計算群組淨額失敗", err);
        }
        return [g.groupId, 0] as const;
      }
    }),
  );

  return { groups, netMap: Object.fromEntries(netEntries) };
}

export interface ContactWithNet extends PersonalContact {
  netAmount: number;
  lastInteraction: Date | null;
}

/** 讀取所有個人聯絡人並計算各自的淨額（首頁與個人頁共用同一份快取） */
export async function loadContactsWithNet(
  userId: string,
  source: ReadSource,
): Promise<ContactWithNet[]> {
  const contacts = await getContacts(userId, source);
  return Promise.all(
    contacts.map(async (c) => {
      const expenses = await getPersonalExpenses(userId, c.contactId, source);
      const lastSeconds = (expenses[0]?.date as { seconds?: number } | undefined)
        ?.seconds;
      return {
        ...c,
        netAmount: computePersonalNetAmount(expenses),
        lastInteraction: lastSeconds ? new Date(lastSeconds * 1000) : null,
      };
    }),
  );
}
