import { useCallback, useEffect, useRef } from "react";

/**
 * 表單有未儲存的內容時，攔下系統返回（Android 返回鍵、iOS 側滑、瀏覽器上一頁）。
 *
 * App 用的是 BrowserRouter，沒有 data router 的 useBlocker，所以自己在歷史紀錄多推一格
 * 同網址、同 state 的「陷阱」：系統返回只會吃掉這一格（React Router 看到的是同一個位置，
 * 頁面不會卸載），我們在 popstate 裡補推回去並呼叫 onBlocked 跳出「放棄變更？」。
 *
 * - `leave()`：使用者確認放棄，連同陷阱一起退回上一頁。
 * - `release()`：儲存成功要程式導頁前先呼叫，把陷阱退掉，免得歷史裡留一格空白表單。
 */
export function useUnsavedChangesGuard(dirty: boolean, onBlocked: () => void) {
  const trappedRef = useRef(false);
  const bypassRef = useRef(false);
  const dirtyRef = useRef(dirty);
  const onBlockedRef = useRef(onBlocked);

  useEffect(() => {
    dirtyRef.current = dirty;
    onBlockedRef.current = onBlocked;
  });

  // 第一次有未儲存內容時推入陷阱
  useEffect(() => {
    if (!dirty || trappedRef.current || bypassRef.current) return;
    window.history.pushState(window.history.state, "", window.location.href);
    trappedRef.current = true;
  }, [dirty]);

  useEffect(() => {
    // 被擋下後要等使用者下一次點擊／按鍵才把陷阱補回去，不能在 popstate 裡直接補：
    // Android Chrome 會把「沒有使用者操作就 pushState」離開的那一格標成可略過，
    // 下一次系統返回會整個跳過表單（2026-11-08 Pixel 實測：直接把分頁關掉）。
    // 點「繼續編輯」或「放棄」本身就是那次點擊——放棄時陷阱已補回，leave() 照樣退兩格。
    const rearm = () => {
      window.removeEventListener("click", rearm, true);
      window.removeEventListener("keydown", rearm, true);
      if (trappedRef.current || bypassRef.current || !dirtyRef.current) return;
      window.history.pushState(window.history.state, "", window.location.href);
      trappedRef.current = true;
    };
    const onPopState = () => {
      if (!trappedRef.current || bypassRef.current) return;
      // 系統返回吃掉了陷阱，現在停在表單本身那一格
      trappedRef.current = false;
      if (!dirtyRef.current) {
        // 內容已經清空，不必再問：照使用者的意思真的返回
        window.history.back();
        return;
      }
      window.addEventListener("click", rearm, true);
      window.addEventListener("keydown", rearm, true);
      onBlockedRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("click", rearm, true);
      window.removeEventListener("keydown", rearm, true);
    };
  }, []);

  // 重新整理／關閉分頁時也提醒（瀏覽器自己的對話框）
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypassRef.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const leave = useCallback(() => {
    bypassRef.current = true;
    const steps = trappedRef.current ? 2 : 1;
    trappedRef.current = false;
    window.history.go(-steps);
  }, []);

  const release = useCallback(
    () =>
      new Promise<void>((resolve) => {
        bypassRef.current = true;
        if (!trappedRef.current) {
          resolve();
          return;
        }
        trappedRef.current = false;
        const done = () => {
          window.removeEventListener("popstate", done);
          window.clearTimeout(timer);
          resolve();
        };
        // 保險：極少數環境 popstate 不來時也要繼續導頁
        const timer = window.setTimeout(done, 400);
        window.addEventListener("popstate", done);
        window.history.back();
      }),
    [],
  );

  return { leave, release };
}
