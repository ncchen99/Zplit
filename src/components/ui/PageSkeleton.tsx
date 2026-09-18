import { useLocation } from "react-router-dom";

const TAB_PATHS = ["/", "/home", "/groups", "/personal", "/settings"];

interface PageSkeletonProps {
  /**
   * - `list`：底部導覽列分頁（標題 + 搜尋列 + 清單）
   * - `detail`：全螢幕子頁面（返回列 + 摘要卡 + 清單）
   * 未指定時依目前路由自動判斷。
   */
  variant?: "list" | "detail";
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

/** 頁面載入中的骨架畫面，取代全頁 spinner，讓版面在資料到達前就先成形 */
export function PageSkeleton({ variant, rows = 4 }: PageSkeletonProps) {
  const { pathname } = useLocation();
  const resolved = variant ?? (TAB_PATHS.includes(pathname) ? "list" : "detail");

  if (resolved === "detail") {
    return (
      <div
        className="flex min-h-[100dvh] flex-col md:min-h-[inherit]"
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

  return (
    <div className="px-4 pt-4 pb-4" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-28" />
        <div className="skeleton h-8 w-8 rounded-full" />
      </div>
      <div className="skeleton mt-4 h-10 w-full rounded-xl" />
      <ListRows rows={rows} />
    </div>
  );
}
