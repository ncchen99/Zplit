import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { ZplitError } from '@/utils/errors';
import type { ExpenseSplit, EditLogEntry } from '@/store/groupStore';

export interface NewExpenseInput {
  title: string;
  amount: number;
  paidBy: string;
  splitMode: 'equal' | 'amount' | 'percent';
  splits: ExpenseSplit[];
  description: string | null;
  imageUrl: string | null;
  date: Date;
  createdBy: string;
}

export async function addExpense(groupId: string, data: NewExpenseInput): Promise<string> {
  const module = 'expenses.add';

  // Validate splits
  const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
  if (splitTotal !== data.amount) {
    logger.warn(module, '分帳金額與帳單不符', { data, splitTotal });
    throw new ZplitError(
      'EXPENSE_SPLIT_MISMATCH',
      `分帳加總 ${splitTotal} 不等於帳單 ${data.amount}`
    );
  }

  try {
    const ref = doc(collection(db, `groups/${groupId}/expenses`));
    const editLog: EditLogEntry[] = [
      {
        memberId: data.createdBy,
        action: 'created',
        description: `新增「${data.title} NT$${data.amount}」`,
        timestamp: new Date() as unknown as import('firebase/firestore').Timestamp,
      },
    ];

    await setDoc(ref, {
      ...data,
      expenseId: ref.id,
      date: data.date,
      repeat: null,
      editLog,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info(module, '帳務新增成功', { expenseId: ref.id, groupId });
    return ref.id;
  } catch (err) {
    logger.error(module, '帳務新增失敗', { groupId, data, err });
    throw new ZplitError('EXPENSE_SAVE_FAILED', '儲存帳務時發生錯誤', err);
  }
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  data: Partial<NewExpenseInput>,
  _editedBy: string
): Promise<void> {
  try {
    const ref = doc(db, `groups/${groupId}/expenses/${expenseId}`);
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    logger.info('expenses.update', '帳務更新成功', { expenseId, groupId });
  } catch (err) {
    logger.error('expenses.update', '帳務更新失敗', { groupId, expenseId, err });
    throw new ZplitError('EXPENSE_SAVE_FAILED', '更新帳務時發生錯誤', err);
  }
}

export async function deleteExpense(groupId: string, expenseId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, `groups/${groupId}/expenses/${expenseId}`));
    logger.info('expenses.delete', '帳務刪除成功', { expenseId, groupId });
  } catch (err) {
    logger.error('expenses.delete', '帳務刪除失敗', { groupId, expenseId, err });
    throw new ZplitError('EXPENSE_SAVE_FAILED', '刪除帳務時發生錯誤', err);
  }
}
