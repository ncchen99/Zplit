import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  terminate,
  waitForPendingWrites,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// IndexedDB 本機快取：重開 App 時先顯示本機資料、離線時仍可瀏覽，
// 離線寫入會排入佇列、恢復連線後自動同步。多分頁共用同一份快取。
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// 本機測試：連到 Firebase Emulator，避免在正式專案留下測試資料
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

/**
 * 登出後清除本機 Firestore 快取（共用裝置時不留下前一位使用者的資料），並重新載入頁面。
 * 清除前會短暫等待尚未同步的寫入送出；離線時無法等待，未同步的變更會被捨棄。
 */
export async function clearLocalDataAndReload(): Promise<void> {
  try {
    if (navigator.onLine) {
      await Promise.race([
        waitForPendingWrites(db),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    }
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // 其他分頁仍開著時無法清除 — 至少重新載入以釋放記憶體中的資料
  }
  window.location.replace("/login");
}
