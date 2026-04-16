import { useUIStore } from "@/store/uiStore";

export function ToastProvider() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className={`fixed right-4 top-2 z-50 flex flex-col gap-2`}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-soft max-w-xs ${
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
