import { create } from "zustand";
import type { User as FirebaseUser } from "firebase/auth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { logger } from "@/utils/logger";

export type AuthStatus = "loading" | "guest" | "onboarding" | "ready";

export interface AppUser {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
}

const CACHED_USER_KEY = "zplit.cachedUser";

/** Last known profile, used to render instantly on reload before Firestore responds. */
export function readCachedUser(uid: string): AppUser | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as AppUser;
    return cached.uid === uid && cached.displayName ? cached : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AppUser | null) {
  try {
    if (user) localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHED_USER_KEY);
  } catch {
    // Storage unavailable (private mode, quota) — cache is optional
  }
}

interface AuthStore {
  status: AuthStatus;
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  setFirebaseUser: (u: FirebaseUser | null) => void;
  setUser: (u: AppUser | null) => void;
  setStatus: (s: AuthStatus) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: "loading",
  user: null,
  firebaseUser: null,

  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setUser: (user) => {
    writeCachedUser(user);
    set({ user });
  },
  setStatus: (status) => set({ status }),

  logout: async () => {
    try {
      await signOut(auth);
      writeCachedUser(null);
      set({ status: "guest", user: null, firebaseUser: null });
      logger.info("auth.logout", "使用者已登出");
    } catch (err) {
      logger.error("auth.logout", "登出失敗", err);
    }
  },
}));
