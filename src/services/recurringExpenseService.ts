import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Expense } from "@/store/groupStore";
import { getNextRecurringDate } from "@/lib/algorithm/recurring";

function isRecurringExpense(expense: Expense): boolean {
  return Boolean(expense.repeat?.type && expense.repeat?.nextRunAt);
}

function shouldGenerate(expense: Expense, now: Date): boolean {
  if (!expense.repeat) return false;
  const nextRun = expense.repeat.nextRunAt?.toDate();
  if (!nextRun) return false;
  if (
    expense.repeat.endDate &&
    expense.repeat.endDate.toDate().getTime() < now.getTime()
  ) {
    return false;
  }
  return nextRun.getTime() <= now.getTime();
}

export async function generateDueRecurringExpenses(
  groupId: string,
  now = new Date(),
): Promise<number> {
  const expenseQuery = query(
    collection(db, `groups/${groupId}/expenses`),
    where("repeat", "!=", null),
  );
  const snap = await getDocs(expenseQuery);
  const expenses = snap.docs.map((d) => ({
    ...d.data(),
    expenseId: d.id,
  })) as Expense[];

  const due = expenses.filter(
    (expense) => isRecurringExpense(expense) && shouldGenerate(expense, now),
  );
  if (due.length === 0) return 0;

  const batch = writeBatch(db);

  for (const source of due) {
    if (!source.repeat) continue;

    const newRef = doc(collection(db, `groups/${groupId}/expenses`));
    const nextRun = getNextRecurringDate(
      source.repeat.nextRunAt.toDate(),
      source.repeat.type,
    );

    batch.set(newRef, {
      title: source.title,
      amount: source.amount,
      paidBy: source.paidBy,
      splitMode: source.splitMode,
      splits: source.splits,
      description: source.description,
      imageUrl: source.imageUrl,
      date: Timestamp.fromDate(source.repeat.nextRunAt.toDate()),
      createdBy: source.createdBy,
      expenseId: newRef.id,
      repeat: {
        ...source.repeat,
        originExpenseId: source.repeat.originExpenseId ?? source.expenseId,
        nextRunAt: Timestamp.fromDate(nextRun),
      },
      editLog: source.editLog,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, `groups/${groupId}/expenses/${source.expenseId}`), {
      "repeat.nextRunAt": Timestamp.fromDate(nextRun),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return due.length;
}
