import {
  doc,
  collection,
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/utils/logger";
import { ZplitError } from "@/utils/errors";
import type { ExpenseSplit, EditLogEntry } from "@/store/groupStore";

type ExpenseActivityAction = "created" | "updated" | "deleted";

function buildActivityDescription(
  action: ExpenseActivityAction,
  title: string,
  amount: number,
): string {
  if (action === "updated") {
    return `修改「${title} NT$${amount}」`;
  }
  if (action === "deleted") {
    return `刪除「${title} NT$${amount}」`;
  }
  return `新增「${title} NT$${amount}」`;
}

export interface NewExpenseInput {
  title: string;
  amount: number;
  paidBy: string;
  splitMode: "equal" | "amount" | "percent";
  splits: ExpenseSplit[];
  description: string | null;
  imageUrl: string | null;
  date: Date;
  createdBy: string;
  /** 標記此帳務為結算付款（由 SettleTab 建立） */
  isSettlement?: boolean;
}

async function syncGroupLastExpenseAt(groupId: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, `groups/${groupId}/expenses`),
      orderBy("date", "desc"),
      limit(1),
    ),
  );
  const lastExpenseAt = snap.docs[0]?.data().date ?? null;
  await updateDoc(doc(db, "groups", groupId), {
    lastExpenseAt,
    updatedAt: serverTimestamp(),
  });
}

export async function addExpense(
  groupId: string,
  data: NewExpenseInput,
): Promise<string> {
  const module = "expenses.add";

  // Validate splits
  const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
  if (splitTotal !== data.amount) {
    logger.warn(module, "分帳金額與帳單不符", { data, splitTotal });
    throw new ZplitError(
      "EXPENSE_SPLIT_MISMATCH",
      `分帳加總 ${splitTotal} 不等於帳單 ${data.amount}`,
    );
  }

  try {
    const ref = doc(collection(db, `groups/${groupId}/expenses`));
    const activityRef = doc(collection(db, `groups/${groupId}/activity`));
    const groupRef = doc(db, "groups", groupId);
    const editLog: EditLogEntry[] = [
      {
        memberId: data.createdBy,
        action: "created",
        description: buildActivityDescription(
          "created",
          data.title,
          data.amount,
        ),
        timestamp:
          new Date() as unknown as import("firebase/firestore").Timestamp,
      },
    ];

    const batch = writeBatch(db);
    batch.set(ref, {
      title: data.title,
      amount: data.amount,
      paidBy: data.paidBy,
      splitMode: data.splitMode,
      splits: data.splits,
      description: data.description,
      imageUrl: data.imageUrl,
      date: data.date,
      createdBy: data.createdBy,
      expenseId: ref.id,
      editLog,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(activityRef, {
      activityId: activityRef.id,
      expenseId: ref.id,
      actorUid: data.createdBy,
      action: "created",
      title: data.title,
      amount: data.amount,
      description: buildActivityDescription("created", data.title, data.amount),
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      ...(data.isSettlement && {
        isSettlement: true,
        settlementFrom: data.paidBy,
        settlementTo: data.splits[0]?.memberId ?? null,
      }),
    });
    batch.update(groupRef, {
      lastExpenseAt: data.date,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    logger.info(module, "帳務新增成功", { expenseId: ref.id, groupId });
    return ref.id;
  } catch (err) {
    logger.error(module, "帳務新增失敗", { groupId, data, err });
    throw new ZplitError("EXPENSE_SAVE_FAILED", "儲存帳務時發生錯誤", err);
  }
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  data: Partial<NewExpenseInput>,
  editedBy: string,
): Promise<void> {
  try {
    const ref = doc(db, `groups/${groupId}/expenses/${expenseId}`);
    const activityRef = doc(collection(db, `groups/${groupId}/activity`));
    const title = data.title?.trim() || "帳務";
    const amount = data.amount ?? 0;
    const batch = writeBatch(db);

    batch.update(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    batch.set(activityRef, {
      activityId: activityRef.id,
      expenseId,
      actorUid: editedBy,
      action: "updated",
      title,
      amount,
      description: buildActivityDescription("updated", title, amount),
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    await syncGroupLastExpenseAt(groupId).catch((err) => {
      logger.warn("expenses.update.syncLastExpenseAt", "同步最近記帳時間失敗", {
        groupId,
        expenseId,
        err,
      });
    });
    logger.info("expenses.update", "帳務更新成功", { expenseId, groupId });
  } catch (err) {
    logger.error("expenses.update", "帳務更新失敗", {
      groupId,
      expenseId,
      err,
    });
    throw new ZplitError("EXPENSE_SAVE_FAILED", "更新帳務時發生錯誤", err);
  }
}

export async function deleteExpense(
  groupId: string,
  expense: { expenseId: string; title: string; amount: number },
  deletedBy: string,
): Promise<void> {
  try {
    const ref = doc(db, `groups/${groupId}/expenses/${expense.expenseId}`);
    const activityRef = doc(collection(db, `groups/${groupId}/activity`));
    const batch = writeBatch(db);

    batch.delete(ref);
    batch.set(activityRef, {
      activityId: activityRef.id,
      expenseId: expense.expenseId,
      actorUid: deletedBy,
      action: "deleted",
      title: expense.title,
      amount: expense.amount,
      description: buildActivityDescription(
        "deleted",
        expense.title,
        expense.amount,
      ),
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    await syncGroupLastExpenseAt(groupId).catch((err) => {
      logger.warn("expenses.delete.syncLastExpenseAt", "同步最近記帳時間失敗", {
        groupId,
        expenseId: expense.expenseId,
        err,
      });
    });
    logger.info("expenses.delete", "帳務刪除成功", {
      expenseId: expense.expenseId,
      groupId,
    });
  } catch (err) {
    logger.error("expenses.delete", "帳務刪除失敗", {
      groupId,
      expenseId: expense.expenseId,
      err,
    });
    throw new ZplitError("EXPENSE_SAVE_FAILED", "刪除帳務時發生錯誤", err);
  }
}
