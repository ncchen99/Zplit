import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser } from "@/store/authStore";
import { logger } from "@/utils/logger";

export async function getUser(uid: string): Promise<AppUser | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: snap.id,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl ?? null,
      isAnonymous: data.isAnonymous ?? false,
    };
  } catch (err) {
    logger.error("userService.getUser", "讀取使用者失敗", err);
    return null;
  }
}

export async function createOrUpdateUser(
  uid: string,
  data: { displayName: string; avatarUrl: string | null; isAnonymous: boolean },
): Promise<AppUser> {
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { uid, ...data };
}
