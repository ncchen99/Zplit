import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, clearLocalDataAndReload } from "@/lib/firebase";
import { clearQueryMemoryCache } from "@/hooks/useCachedQuery";
import { readCachedUser, useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { getUser } from "@/services/userService";
import { logger } from "@/utils/logger";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { AuthGuard } from "@/components/AuthGuard";
import { MainLayout } from "@/components/MainLayout";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

const LoginPage = lazy(() =>
  import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const OnboardingPage = lazy(() =>
  import("@/pages/onboarding/OnboardingPage").then((m) => ({ default: m.OnboardingPage })),
);
const CreateGroupPage = lazy(() =>
  import("@/pages/groups/CreateGroupPage").then((m) => ({ default: m.CreateGroupPage })),
);
const GroupDetailPage = lazy(() =>
  import("@/pages/groups/GroupDetailPage").then((m) => ({ default: m.GroupDetailPage })),
);
const AddExpensePage = lazy(() =>
  import("@/pages/groups/AddExpensePage").then((m) => ({ default: m.AddExpensePage })),
);
const ExpenseDetailPage = lazy(() =>
  import("@/pages/groups/ExpenseDetailPage").then((m) => ({ default: m.ExpenseDetailPage })),
);
const EditExpensePage = lazy(() =>
  import("@/pages/groups/EditExpensePage").then((m) => ({ default: m.EditExpensePage })),
);
const EditGroupPage = lazy(() =>
  import("@/pages/groups/EditGroupPage").then((m) => ({ default: m.EditGroupPage })),
);
const JoinPage = lazy(() =>
  import("@/pages/join/JoinPage").then((m) => ({ default: m.JoinPage })),
);
const PersonalContactDetailPage = lazy(() =>
  import("@/pages/personal/PersonalContactDetailPage").then((m) => ({ default: m.PersonalContactDetailPage })),
);
const AddPersonalExpensePage = lazy(() =>
  import("@/pages/personal/AddPersonalExpensePage").then((m) => ({ default: m.AddPersonalExpensePage })),
);
const PersonalExpenseDetailPage = lazy(() =>
  import("@/pages/personal/PersonalExpenseDetailPage").then((m) => ({ default: m.PersonalExpenseDetailPage })),
);
const EditPersonalExpensePage = lazy(() =>
  import("@/pages/personal/EditPersonalExpensePage").then((m) => ({ default: m.EditPersonalExpensePage })),
);
const EditProfilePage = lazy(() =>
  import("@/pages/settings/EditProfilePage").then((m) => ({ default: m.EditProfilePage })),
);

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);

  useEffect(() => {
    let prevUid: string | null = null;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      const signedOut = prevUid !== null && !fbUser;
      prevUid = fbUser?.uid ?? null;

      if (!fbUser) {
        if (signedOut) {
          // 由登入狀態變為登出（登出、刪除帳號等）：清除本機快取
          clearQueryMemoryCache();
          void clearLocalDataAndReload();
        }
        setStatus("guest");
        setFirebaseUser(null);
        setUser(null);
        return;
      }

      setFirebaseUser(fbUser);

      // Returning user: render immediately from the cached profile and
      // refresh it in the background instead of blocking on Firestore.
      const cached = readCachedUser(fbUser.uid);
      if (cached) {
        setUser(cached);
        setStatus("ready");
        const fresh = await getUser(fbUser.uid);
        if (fresh?.displayName) setUser(fresh);
        return;
      }

      try {
        const userDoc = await getUser(fbUser.uid);
        if (!userDoc?.displayName) {
          setStatus("onboarding");
        } else {
          setUser(userDoc);
          setStatus("ready");
        }
      } catch (err) {
        logger.error("auth.init", "讀取使用者資料失敗", err);
        setStatus("onboarding");
      }
    });

    return () => unsub();
  }, [setFirebaseUser, setStatus, setUser]);

  return <>{children}</>;
}

function NetworkListener() {
  const { t } = useTranslation();
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    const onOffline = () => {
      logger.warn("network", "裝置離線");
      showToast(t("common.offline"), "info");
    };
    const onOnline = () => {
      logger.info("network", "裝置恢復連線");
      showToast(t("common.online"), "success");
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [showToast, t]);

  return null;
}

export default function App() {
  // Global unhandled error listeners
  useEffect(() => {
    const onUnhandled = (event: PromiseRejectionEvent) => {
      logger.error(
        "global.unhandledRejection",
        event.reason?.message ?? "Unknown",
        {
          reason: event.reason,
        },
      );
    };
    const onError = (event: ErrorEvent) => {
      logger.error("global.uncaughtError", event.message, {
        filename: event.filename,
        lineno: event.lineno,
      });
    };

    window.addEventListener("unhandledrejection", onUnhandled);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.removeEventListener("error", onError);
    };
  }, []);

  // Lock app scrolling whenever any daisyUI modal is open
  useEffect(() => {
    const root = document.getElementById("root");

    const syncModalScrollLock = () => {
      const hasOpenModal =
        document.querySelector(".modal.modal-open") !== null;
      document.body.classList.toggle("scroll-locked", hasOpenModal);
      root?.classList.toggle("scroll-locked", hasOpenModal);
    };

    const observer = new MutationObserver(syncModalScrollLock);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    syncModalScrollLock();

    return () => {
      observer.disconnect();
      document.body.classList.remove("scroll-locked");
      root?.classList.remove("scroll-locked");
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthInitializer>
            <NetworkListener />
            <OfflineBanner />
            <ToastProvider />
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                {/* Public routes */}
                <Route
                  path="/login"
                  element={
                    <AuthGuard>
                      <LoginPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/join/:code"
                  element={
                    <AuthGuard>
                      <JoinPage />
                    </AuthGuard>
                  }
                />

                {/* Onboarding */}
                <Route
                  path="/onboarding"
                  element={
                    <AuthGuard>
                      <OnboardingPage />
                    </AuthGuard>
                  }
                />

                {/* Protected routes with bottom nav */}
                {/* MainLayout 自己渲染這四頁（可左右滑動切換），
                    子路由只負責決定目前是哪一頁，因此不帶 element */}
                <Route
                  element={
                    <AuthGuard>
                      <MainLayout />
                    </AuthGuard>
                  }
                >
                  <Route path="/home" />
                  <Route path="/groups" />
                  <Route path="/personal" />
                  <Route path="/settings" />
                </Route>

                {/* Protected routes without bottom nav */}
                <Route
                  path="/groups/new"
                  element={
                    <AuthGuard>
                      <CreateGroupPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/groups/:groupId"
                  element={
                    <AuthGuard>
                      <GroupDetailPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/groups/:groupId/expense/new"
                  element={
                    <AuthGuard>
                      <AddExpensePage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/groups/:groupId/expenses/:expenseId"
                  element={
                    <AuthGuard>
                      <ExpenseDetailPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/groups/:groupId/expense/:expenseId/edit"
                  element={
                    <AuthGuard>
                      <EditExpensePage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/groups/:groupId/edit"
                  element={
                    <AuthGuard>
                      <EditGroupPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/personal/expense/new"
                  element={
                    <AuthGuard>
                      <AddPersonalExpensePage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/personal/:contactId"
                  element={
                    <AuthGuard>
                      <PersonalContactDetailPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/personal/:contactId/expense/new"
                  element={
                    <AuthGuard>
                      <AddPersonalExpensePage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/personal/:contactId/expenses/:expenseId"
                  element={
                    <AuthGuard>
                      <PersonalExpenseDetailPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/personal/:contactId/expenses/:expenseId/edit"
                  element={
                    <AuthGuard>
                      <EditPersonalExpensePage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/settings/profile"
                  element={
                    <AuthGuard>
                      <EditProfilePage />
                    </AuthGuard>
                  }
                />

                {/* Fallback */}
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </Suspense>
          </AuthInitializer>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
