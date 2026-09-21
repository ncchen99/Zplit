import { lazy, Suspense, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/ui/BottomNav";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { SwipeViews } from "@/components/ui/SwipeViews";

const HomePage = lazy(() =>
  import("@/pages/main/HomePage").then((m) => ({ default: m.HomePage })),
);
const GroupListPage = lazy(() =>
  import("@/pages/groups/GroupListPage").then((m) => ({
    default: m.GroupListPage,
  })),
);
const PersonalPage = lazy(() =>
  import("@/pages/main/PersonalPage").then((m) => ({ default: m.PersonalPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/main/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

// 順序要和 BottomNav 一致：左右滑動就是在這四頁之間移動
const TAB_PAGES = [
  { path: "/home", Page: HomePage },
  { path: "/groups", Page: GroupListPage },
  { path: "/personal", Page: PersonalPage },
  { path: "/settings", Page: SettingsPage },
] as const;

// Warm up the other bottom-nav tabs once the current page is idle,
// so switching tabs does not wait on a chunk download.
function prefetchTabPages() {
  void import("@/pages/main/HomePage");
  void import("@/pages/groups/GroupListPage");
  void import("@/pages/main/PersonalPage");
  void import("@/pages/main/SettingsPage");
}

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetchTabPages, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetchTabPages, 1500);
    return () => clearTimeout(id);
  }, []);

  const activeIndex = Math.max(
    0,
    TAB_PAGES.findIndex(
      ({ path }) =>
        location.pathname === path ||
        location.pathname.startsWith(path + "/"),
    ),
  );

  return (
    <div className="relative flex h-full min-h-[inherit] flex-col overflow-hidden">
      {/* 各分頁自行固定標頭、內層 ScrollArea 捲動，這層不再捲動 */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SwipeViews
          index={activeIndex}
          count={TAB_PAGES.length}
          onIndexChange={(next) => navigate(TAB_PAGES[next].path)}
          renderPage={(i) => {
            const { Page } = TAB_PAGES[i];
            return (
              <Suspense fallback={<PageSkeleton withNav={false} />}>
                <Page />
              </Suspense>
            );
          }}
        />
      </main>
      <BottomNav />
    </div>
  );
}
