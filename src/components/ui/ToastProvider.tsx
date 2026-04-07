import { useUIStore } from '@/store/uiStore';

export function ToastProvider() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast toast-top toast-end z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`alert ${
            t.type === 'success'
              ? 'alert-success'
              : t.type === 'error'
                ? 'alert-error'
                : 'alert-info'
          } cursor-pointer shadow-lg`}
          onClick={() => removeToast(t.id)}
        >
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
