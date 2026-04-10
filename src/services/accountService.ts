import {
  GoogleAuthProvider,
  linkWithPopup,
  type User as FirebaseUser,
} from "firebase/auth";
import { createOrUpdateUser, getUser } from "@/services/userService";
import { logger } from "@/utils/logger";
import type { AppUser } from "@/store/authStore";

export async function linkAnonymousAccountWithGoogle(
  firebaseUser: FirebaseUser,
): Promise<AppUser> {
  const provider = new GoogleAuthProvider();
  const result = await linkWithPopup(firebaseUser, provider);

  const linkedUser = result.user;
  const previousProfile = await getUser(linkedUser.uid);
  const displayName =
    linkedUser.displayName || previousProfile?.displayName || "User";
  const avatarUrl = linkedUser.photoURL || previousProfile?.avatarUrl || null;

  const appUser = await createOrUpdateUser(linkedUser.uid, {
    displayName,
    avatarUrl,
    isAnonymous: false,
  });

  logger.info("account.linkGoogle", "匿名帳號已升級並綁定 Google", {
    uid: linkedUser.uid,
    provider: linkedUser.providerData?.map((p) => p.providerId) ?? [],
  });

  return appUser;
}
