import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { nanoid } from "nanoid";
import { logger } from "@/utils/logger";
import { ZplitError } from "@/utils/errors";

// ─── Types ────────────────────────────────────────────

export interface PersonalContact {
  contactId: string;
  displayName: string;
  avatarUrl: string | null;
  linkedUserId: string | null;
  interactionCount: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PersonalExpense {
  expenseId: string;
  title: string;
  amount: number;
  /** 'self' = current user paid; 'contact' = contact paid */
  paidBy: "self" | "contact";
  description: string | null;
  imageUrl: string | null;
  date: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PersonalExpenseInput {
  title: string;
  amount: number;
  paidBy: "self" | "contact";
  description: string | null;
  imageUrl: string | null;
  date: Date;
}

// ─── Contact CRUD ────────────────────────────────────

export async function getContacts(userId: string): Promise<PersonalContact[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, `personalLedger/${userId}/contacts`),
        orderBy("interactionCount", "desc"),
      ),
    );
    return snap.docs.map(
      (d) => ({ contactId: d.id, ...d.data() }) as PersonalContact,
    );
  } catch (err) {
    logger.error("personal.getContacts", "讀取聯絡人失敗", err);
    throw new ZplitError(
      "EXPENSE_SAVE_FAILED",
      "讀取個人聯絡人時發生錯誤",
      err,
    );
  }
}

export async function getContact(
  userId: string,
  contactId: string,
): Promise<PersonalContact | null> {
  try {
    const snap = await getDoc(
      doc(db, `personalLedger/${userId}/contacts/${contactId}`),
    );
    if (!snap.exists()) return null;
    return { contactId: snap.id, ...snap.data() } as PersonalContact;
  } catch (err) {
    logger.error("personal.getContact", "讀取聯絡人失敗", err);
    return null;
  }
}

export async function createContact(
  userId: string,
  displayName: string,
  linkedUserId: string | null = null,
  avatarUrl: string | null = null,
): Promise<PersonalContact> {
  const contactId = nanoid();
  const ref = doc(db, `personalLedger/${userId}/contacts/${contactId}`);

  const data = {
    displayName,
    avatarUrl,
    linkedUserId,
    interactionCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);
  logger.info("personal.createContact", "建立聯絡人成功", {
    userId,
    contactId,
    displayName,
  });

  return { contactId, ...data } as PersonalContact;
}

export async function updateContact(
  userId: string,
  contactId: string,
  data: Partial<
    Pick<PersonalContact, "displayName" | "avatarUrl" | "linkedUserId">
  >,
): Promise<void> {
  try {
    await updateDoc(doc(db, `personalLedger/${userId}/contacts/${contactId}`), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    logger.info("personal.updateContact", "更新聯絡人成功", {
      userId,
      contactId,
    });
  } catch (err) {
    logger.error("personal.updateContact", "更新聯絡人失敗", err);
    throw new ZplitError("EXPENSE_SAVE_FAILED", "更新聯絡人時發生錯誤", err);
  }
}

export async function deleteContact(
  userId: string,
  contactId: string,
): Promise<void> {
  try {
    // Delete all expenses under this contact first
    const expensesSnap = await getDocs(
      collection(db, `personalLedger/${userId}/contacts/${contactId}/expenses`),
    );
    const batch = writeBatch(db);
    expensesSnap.docs.forEach((d) => batch.delete(d.ref));
    // Delete the contact itself
    batch.delete(doc(db, `personalLedger/${userId}/contacts/${contactId}`));
    await batch.commit();

    logger.info("personal.deleteContact", "刪除聯絡人成功", {
      userId,
      contactId,
    });
  } catch (err) {
    logger.error("personal.deleteContact", "刪除聯絡人失敗", err);
    throw new ZplitError("EXPENSE_SAVE_FAILED", "刪除聯絡人時發生錯誤", err);
  }
}

// ─── Expense CRUD ────────────────────────────────────

export async function getPersonalExpenses(
  userId: string,
  contactId: string,
): Promise<PersonalExpense[]> {
  try {
    const snap = await getDocs(
      query(
        collection(
          db,
          `personalLedger/${userId}/contacts/${contactId}/expenses`,
        ),
        orderBy("date", "desc"),
      ),
    );
    return snap.docs.map(
      (d) => ({ expenseId: d.id, ...d.data() }) as PersonalExpense,
    );
  } catch (err) {
    logger.error("personal.getExpenses", "讀取個人帳務失敗", err);
    throw new ZplitError("EXPENSE_SAVE_FAILED", "讀取個人帳務時發生錯誤", err);
  }
}

export async function addPersonalExpense(
  userId: string,
  contactId: string,
  data: PersonalExpenseInput,
): Promise<string> {
  try {
    const ref = doc(
      collection(db, `personalLedger/${userId}/contacts/${contactId}/expenses`),
    );

    await setDoc(ref, {
      ...data,
      expenseId: ref.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Bump interaction count
    await updateDoc(doc(db, `personalLedger/${userId}/contacts/${contactId}`), {
      interactionCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    logger.info("personal.addExpense", "個人帳務新增成功", {
      userId,
      contactId,
      expenseId: ref.id,
    });
    return ref.id;
  } catch (err) {
    logger.error("personal.addExpense", "個人帳務新增失敗", err);
    throw new ZplitError("EXPENSE_SAVE_FAILED", "儲存個人帳務時發生錯誤", err);
  }
}

export async function updatePersonalExpense(
  userId: string,
  contactId: string,
  expenseId: string,
  data: Partial<PersonalExpenseInput>,
): Promise<void> {
  try {
    const ref = doc(
      db,
      `personalLedger/${userId}/contacts/${contactId}/expenses/${expenseId}`,
    );
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    logger.info("personal.updateExpense", "個人帳務更新成功", {
      userId,
      contactId,
      expenseId,
    });
  } catch (err) {
    logger.error("personal.updateExpense", "個人帳務更新失敗", err);
    throw new ZplitError("EXPENSE_SAVE_FAILED", "更新個人帳務時發生錯誤", err);
  }
}

export async function deletePersonalExpense(
  userId: string,
  contactId: string,
  expenseId: string,
): Promise<void> {
  try {
    await deleteDoc(
      doc(
        db,
        `personalLedger/${userId}/contacts/${contactId}/expenses/${expenseId}`,
      ),
    );
    logger.info("personal.deleteExpense", "個人帳務刪除成功", {
      userId,
      contactId,
      expenseId,
    });
  } catch (err) {
    logger.error("personal.deleteExpense", "個人帳務刪除失敗", err);
    throw new ZplitError("EXPENSE_SAVE_FAILED", "刪除個人帳務時發生錯誤", err);
  }
}

// ─── Settlement ────────────────────────────────────

/**
 * Compute net amount for a contact: positive = contact owes you, negative = you owe contact.
 */
export function computePersonalNetAmount(expenses: PersonalExpense[]): number {
  let net = 0;
  for (const e of expenses) {
    if (e.paidBy === "self") {
      // You paid → contact owes you
      net += e.amount;
    } else {
      // Contact paid → you owe contact
      net -= e.amount;
    }
  }
  return net;
}

/**
 * Settle all debts with a contact by adding a settlement record.
 */
export async function settleAllWithContact(
  userId: string,
  contactId: string,
  netAmount: number,
): Promise<void> {
  if (netAmount === 0) return;

  try {
    const ref = doc(
      collection(db, `personalLedger/${userId}/contacts/${contactId}/expenses`),
    );

    // Add a settlement expense that zeroes out the balance
    await setDoc(ref, {
      expenseId: ref.id,
      title: "結清帳款",
      amount: Math.abs(netAmount),
      // If net > 0, contact owed you, so the "settlement" is as if contact paid you back
      // If net < 0, you owed contact, so the "settlement" is as if you paid contact back
      paidBy: netAmount > 0 ? "contact" : "self",
      description: "一次結清所有帳款",
      imageUrl: null,
      date: new Date(),
      isSettlement: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info("personal.settleAll", "個人帳款結清成功", {
      userId,
      contactId,
      netAmount,
    });
  } catch (err) {
    logger.error("personal.settleAll", "個人帳款結清失敗", err);
    throw new ZplitError("EXPENSE_SAVE_FAILED", "結清帳款時發生錯誤", err);
  }
}
