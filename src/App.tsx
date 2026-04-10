import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { getUser } from "@/services/userService";
import { logger } from "@/utils/logger";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { AuthGuard } from "@/components/AuthGuard";
import { MainLayout } from "@/components/MainLayout";

import { LoginPage } from "@/pages/auth/LoginPage";
import { OnboardingPage } from "@/pages/onboarding/OnboardingPage";
import { HomePage } from "@/pages/main/HomePage";
import { SettingsPage } from "@/pages/main/SettingsPage";
import { PersonalPage } from "@/pages/main/PersonalPage";
import { GroupListPage } from "@/pages/groups/GroupListPage";
import { CreateGroupPage } from "@/pages/groups/CreateGroupPage";
import { GroupDetailPage } from "@/pages/groups/GroupDetailPage";
import { AddExpensePage } from "@/pages/groups/AddExpensePage";
import { ExpenseDetailPage } from "@/pages/groups/ExpenseDetailPage";
import { EditExpensePage } from "@/pages/groups/EditExpensePage";
import { EditGroupPage } from "@/pages/groups/EditGroupPage";
import { JoinPage } from "@/pages/join/JoinPage";
import { PersonalContactDetailPage } from "@/pages/personal/PersonalContactDetailPage";
import { AddPersonalExpensePage } from "@/pages/personal/AddPersonalExpensePage";
import { PersonalExpenseDetailPage } from "@/pages/personal/PersonalExpenseDetailPage";
import { EditPersonalExpensePage } from "@/pages/personal/EditPersonalExpensePage";
import { EditProfilePage } from "@/pages/settings/EditProfilePage";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setStatus("guest");
        setFirebaseUser(null);
        setUser(null);
        return;
      }

      setFirebaseUser(fbUser);

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
  }, []);

  return <>{children}</>;
}

function NetworkListener() {
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    const onOffline = () => {
      logger.warn("network", "裝置離線");
      showToast("目前離線，部分功能可能無法使用", "info");
    };
    const onOnline = () => {
      logger.info("network", "裝置恢復連線");
      showToast("已恢復連線", "success");
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

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
            <ToastProvider />
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
              <Route
                element={
                  <AuthGuard>
                    <MainLayout />
                  </AuthGuard>
                }
              >
                <Route path="/home" element={<HomePage />} />
                <Route path="/groups" element={<GroupListPage />} />
                <Route path="/personal" element={<PersonalPage />} />
                <Route path="/settings" element={<SettingsPage />} />
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
          </AuthInitializer>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
