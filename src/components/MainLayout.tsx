import { Suspense, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/ui/BottomNav";

// Warm up the other bottom-nav tabs once the current page is idle,
// so switching tabs does not wait on a chunk download.
function prefetchTabPages() {
  void import("@/pages/main/HomePage");
  void import("@/pages/groups/GroupListPage");
  void import("@/pages/main/PersonalPage");
  void import("@/pages/main/SettingsPage");
}

export function MainLayout() {
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetchTabPages, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetchTabPages, 1500);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="relative flex h-full min-h-[inherit] flex-col overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-16">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center py-24">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
