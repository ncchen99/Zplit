import { useUIStore } from "@/store/uiStore";

export function ToastProvider() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    // 手機優先：toast 出現在畫面正下方（導覽列／FAB 上方），由下往上滑入
    <div className="toast-in-frame flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-soft ${
            t.type === "success"
              ? "toast-soft-success"
              : t.type === "error"
                ? "toast-soft-error"
                : "toast-soft-info"
          } ${t.closing ? "toast-motion-out" : "toast-motion-in"}`}
          onClick={() => removeToast(t.id)}
        >
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
