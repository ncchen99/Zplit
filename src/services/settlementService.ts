import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { computeBalances, computeSettlements } from '@/lib/algorithm/settlement';
import { logger } from '@/utils/logger';
import type { Expense } from '@/store/groupStore';

export async function recalculateSettlements(groupId: string): Promise<void> {
  try {
    // Read all expenses
    const expensesSnap = await getDocs(
      collection(db, `groups/${groupId}/expenses`)
    );
    const expenses = expensesSnap.docs.map((d) => d.data() as Expense);

    // Compute new settlements
    const balances = computeBalances(expenses);
    const newSettlements = computeSettlements(balances);

    const settlementsRef = collection(db, `groups/${groupId}/settlements`);
    // Get all existing incomplete settlements to delete
    const incompleteSnap = await getDocs(
      query(settlementsRef, where('completed', '==', false))
    );

    const batch = writeBatch(db);

    // Delete incomplete settlements
    incompleteSnap.docs.forEach((d) => {
      batch.delete(d.ref);
    });

    // Write new settlements
    for (const s of newSettlements) {
      const ref = doc(collection(db, `groups/${groupId}/settlements`));
      batch.set(ref, {
        ...s,
        completed: false,
        completedBy: null,
        completedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    logger.info('settlement.recalculate', '清算重算完成', {
      groupId,
      count: newSettlements.length,
    });
  } catch (err) {
    logger.error('settlement.recalculate', '清算重算失敗', { groupId, err });
  }
}
