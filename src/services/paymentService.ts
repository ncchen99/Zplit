import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { commitWrite } from "@/lib/firestoreWrite";
import { readDoc } from "@/lib/firestoreRead";
import { getUserGroups } from "@/services/groupService";
import { logger } from "@/utils/logger";

/**
 * 收款方式（銀行帳號、LINE Pay）。
 *
 * 群組文件與 users 文件都是公開讀取（邀請預覽、顯示頭像），不能放帳號，所以分兩處存：
 * - `users/{uid}/private/payment`：本人的原始資料，只有本人讀得到（設定頁用）
 * - `groups/{groupId}/payees/{uid}`：每個群組各一份副本，只有群組成員讀得到（結算頁用）
 *
 * 副本在儲存時寫進自己所有群組；新加入的群組或寫入失敗的，打開群組時由
 * `syncMyPayee` 補上。
 */
export interface PaymentAccount {
  /** 銀行轉帳：代碼與帳號一起有、或一起沒有 */
  bankCode?: string;
  accountNumber?: string;
  /** 可以用 LINE Pay 轉給他（在 LINE 裡選好友轉帳，不需要帳號） */
  linePay?: boolean;
}

const BANK_CODE = /^\d{3}$/;
const ACCOUNT_NUMBER = /^\d{8,16}$/;

export function hasBankAccount(
  a: PaymentAccount,
): a is PaymentAccount & { bankCode: string; accountNumber: string } {
  return !!a.bankCode && !!a.accountNumber;
}

/** 至少要有一種收款方式；有填銀行就要完整且格式正確 */
export function isValidPaymentAccount(a: PaymentAccount): boolean {
  const bankStarted = !!a.bankCode || !!a.accountNumber;
  const bankValid =
    BANK_CODE.test(a.bankCode ?? "") && ACCOUNT_NUMBER.test(a.accountNumber ?? "");
  return bankStarted ? bankValid : !!a.linePay;
}

function privateRef(uid: string) {
  return doc(db, "users", uid, "private", "payment");
}

function payeeRef(groupId: string, uid: string) {
  return doc(db, "groups", groupId, "payees", uid);
}

function toAccount(data: Record<string, unknown> | undefined): PaymentAccount | null {
  if (!data) return null;
  const { bankCode, accountNumber, linePay } = data;
  const account: PaymentAccount = {
    ...(typeof bankCode === "string" &&
      typeof accountNumber === "string" && { bankCode, accountNumber }),
    ...(linePay === true && { linePay: true }),
  };
  return hasBankAccount(account) || account.linePay ? account : null;
}

/** 寫進 Firestore 的欄位：沒有的方式整個不寫，Rules 才驗得過 */
function toDoc(account: PaymentAccount) {
  return {
    ...(hasBankAccount(account) && {
      bankCode: account.bankCode,
      accountNumber: account.accountNumber,
    }),
    ...(account.linePay && { linePay: true }),
    updatedAt: serverTimestamp(),
  };
}

export function sameAccount(a: PaymentAccount | null, b: PaymentAccount | null) {
  return (
    a?.bankCode === b?.bankCode &&
    a?.accountNumber === b?.accountNumber &&
    !!a?.linePay === !!b?.linePay
  );
}

// 每次都重讀、不留在記憶體：另一台裝置改過帳號後，這台拿舊值去「補寫」副本會把新帳號蓋回去
export async function getMyPaymentAccount(
  uid: string,
): Promise<PaymentAccount | null> {
  const snap = await readDoc(privateRef(uid));
  return toAccount(snap.data());
}

/** 儲存（或 account 為 null 時清除）自己的收款帳號，並同步到所有群組 */
export async function saveMyPaymentAccount(
  uid: string,
  account: PaymentAccount | null,
): Promise<void> {
  const groups = await getUserGroups(uid);
  const batch = writeBatch(db);
  const data = account && toDoc(account);

  if (data) batch.set(privateRef(uid), data);
  else batch.delete(privateRef(uid));
  for (const group of groups) {
    if (data) batch.set(payeeRef(group.groupId, uid), data);
    else batch.delete(payeeRef(group.groupId, uid));
  }

  await commitWrite(batch.commit());
}

// 這次開啟 App 已經比對過的群組
const syncedGroups = new Set<string>();

/**
 * 打開群組時確認這個群組裡的副本跟自己的帳號一致，不一致就補寫（或刪掉）。
 * 涵蓋：設定帳號之後才加入／建立的群組、上次同步沒寫成功的群組。
 */
export async function syncMyPayee(groupId: string, uid: string): Promise<void> {
  const key = `${uid}:${groupId}`;
  if (syncedGroups.has(key)) return;
  syncedGroups.add(key);

  try {
    const [mine, snap] = await Promise.all([
      getMyPaymentAccount(uid),
      readDoc(payeeRef(groupId, uid)),
    ]);
    const copy = toAccount(snap.data());
    if (sameAccount(mine, copy)) return;

    const batch = writeBatch(db);
    if (mine) {
      batch.set(payeeRef(groupId, uid), toDoc(mine));
    } else {
      batch.delete(payeeRef(groupId, uid));
    }
    await commitWrite(batch.commit());
  } catch (err) {
    syncedGroups.delete(key);
    logger.warn("paymentService.syncMyPayee", "同步收款帳號失敗", {
      groupId,
      err,
    });
  }
}

/** 群組成員的收款帳號，key 是 userId */
export function subscribePayees(
  groupId: string,
  onChange: (payees: Map<string, PaymentAccount>) => void,
): () => void {
  return onSnapshot(
    collection(db, "groups", groupId, "payees"),
    (snap) => {
      const payees = new Map<string, PaymentAccount>();
      for (const d of snap.docs) {
        const account = toAccount(d.data());
        if (account) payees.set(d.id, account);
      }
      onChange(payees);
    },
    (err) => logger.error("payees.subscribe", "收款帳號監聽失敗", err),
  );
}
