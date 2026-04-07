import { create } from 'zustand';
import type { User as FirebaseUser } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logger } from '@/utils/logger';

export type AuthStatus = 'loading' | 'guest' | 'onboarding' | 'ready';

export interface AppUser {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
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
  status: 'loading',
  user: null,
  firebaseUser: null,

  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),

  logout: async () => {
    try {
      await signOut(auth);
      set({ status: 'guest', user: null, firebaseUser: null });
      logger.info('auth.logout', '使用者已登出');
    } catch (err) {
      logger.error('auth.logout', '登出失敗', err);
    }
  },
}));
