import { useLocation } from "react-router-dom";

// ⚠️ index.html 內有靜態版的 Home 與 Join 骨架（首次載入、JS 尚未執行時顯示），
//    修改 HomeSkeleton / NavSkeleton / JoinSkeleton 版面時請同步更新，
//    兩者需完全一致才不會跳動。

const HOME_PATHS = ["/", "/home"];
const TAB_PATHS = [...HOME_PATHS, "/groups", "/personal", "/settings"];
const JOIN_PATH_PREFIX = "/join/";

type Variant = "home" | "list" | "detail" | "join";

interface PageSkeletonProps {
  /**
   * - `home`：首頁（品牌標頭 + 歡迎列 + 區塊卡片）
   * - `list`：其他底部導覽列分頁（標題 + 搜尋列 + 清單）
   * - `detail`：全螢幕子頁面（返回列 + 摘要卡 + 清單）
   * - `join`：邀請連結落地頁（群組資訊卡 + 單一動作按鈕）
   * 未指定時依目前路由自動判斷。
   */
  variant?: Variant;
  /** 在 MainLayout 內顯示時已有真正的導覽列，傳 false 避免重複 */
  withNav?: boolean;
  rows?: number;
}

function ListRows({ rows }: { rows: number }) {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-3 py-2">
          <div className="skeleton h-12 w-12 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-5 w-12" />
        </div>
      ))}
    </div>
  );
}

/** 首頁「我的群組 / 個人借貸」區塊載入中的骨架（HomePage 也使用同一份） */
export function HomeSectionsSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      {["w-28", "w-32"].map((titleWidth) => (
        <div key={titleWidth} className="space-y-2">
          <div className={`skeleton h-4 ${titleWidth}`} />
          <div className="skeleton h-16 w-full rounded-2xl" />
          <div className="skeleton h-16 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="px-4 pt-4 pb-4">
      {/* 品牌標頭：與 HomePage 相同，載入時就先顯示 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Zplit Logo" className="w-8 h-8" />
          <h1 className="text-2xl font-extrabold tracking-tight text-brand">
            Zplit
          </h1>
        </div>
        <div className="skeleton h-8 w-8 rounded-full" />
      </div>
      <div className="mt-4">
        <div className="flex h-7 items-center">
          <div className="skeleton h-5 w-32" />
        </div>
        <div className="flex h-5 items-center">
          <div className="skeleton h-3.5 w-40" />
        </div>
      </div>
      <HomeSectionsSkeleton />
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-28" />
        <div className="skeleton h-8 w-8 rounded-full" />
      </div>
      <div className="skeleton mt-4 h-10 w-full rounded-xl" />
      <ListRows rows={rows} />
    </div>
  );
}

/**
 * 邀請連結（/join/<code>）的骨架，與 JoinPage 的載入版面一致：
 * 走這條連結的人是來加入群組的，不該先閃一次首頁骨架。
 */
export function JoinSkeleton() {
  return (
    <div
      className="flex h-full min-h-full flex-col overflow-hidden md:min-h-[inherit]"
      aria-busy="true"
    >
      {/* Header placeholder */}
      <div className="min-h-[3.5rem] shrink-0" />

      <div className="flex-1 px-5">
        <div className="mx-auto flex min-h-full w-full max-w-sm flex-col pb-10">
          <div className="skeleton mx-auto mb-4 h-4 w-32 rounded-full" />

          {/* Group info card skeleton */}
          <div className="mb-6 flex flex-col items-center gap-2 rounded-2xl border border-base-300 bg-base-100 px-6 py-6 text-center">
            <div className="skeleton h-16 w-16 rounded-full" />
            <div className="skeleton mt-1 h-7 w-48 rounded-lg" />
            <div className="skeleton h-4 w-24 rounded-md" />
          </div>

          <div className="flex-1" />

          {/* Action button skeleton */}
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** 與 BottomNav 相同尺寸的導覽列骨架 */
function NavSkeleton() {
  return (
    <div className="dock dock-sm dock-in-frame border-t border-base-300 bg-base-100 pb-safe">
      {[0, 1, 2, 3].map((idx) => (
        <div key={idx}>
          <div className="skeleton h-6 w-6 rounded-md" />
          <div className="skeleton h-2.5 w-8" />
        </div>
      ))}
    </div>
  );
}

/** 頁面載入中的骨架畫面，取代全頁 spinner，讓版面在資料到達前就先成形 */
export function PageSkeleton({ variant, withNav = true, rows = 4 }: PageSkeletonProps) {
  const { pathname } = useLocation();
  const resolved: Variant =
    variant ??
    (pathname.startsWith(JOIN_PATH_PREFIX)
      ? "join"
      : HOME_PATHS.includes(pathname)
        ? "home"
        : TAB_PATHS.includes(pathname)
          ? "list"
          : "detail");

  if (resolved === "join") {
    return <JoinSkeleton />;
  }

  if (resolved === "detail") {
    return (
      <div
        className="flex min-h-full flex-col md:min-h-[inherit]"
        aria-busy="true"
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="skeleton h-5 w-32" />
        </div>
        <div className="px-4">
          <div className="skeleton mt-2 h-24 w-full rounded-2xl" />
          <ListRows rows={rows} />
        </div>
      </div>
    );
  }

  const content =
    resolved === "home" ? <HomeSkeleton /> : <ListSkeleton rows={rows} />;

  if (!withNav) return <div aria-busy="true">{content}</div>;

  // 與 MainLayout 相同的外框，確保骨架 → 真實頁面時版面不跳動
  return (
    <div
      className="relative flex h-full min-h-[inherit] flex-col overflow-hidden"
      aria-busy="true"
    >
      <main className="flex-1 overflow-y-auto pb-16">{content}</main>
      <NavSkeleton />
    </div>
  );
}
