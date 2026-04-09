import { useLocation } from 'react-router-dom';
import { useUIStore } from '@/store/uiStore';

// Routes that have the bottom navigation bar (via MainLayout)
const NAV_BAR_ROUTES = ['/home', '/groups', '/personal', '/settings'];

export function ToastProvider() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  const { pathname } = useLocation();

  if (toasts.length === 0) return null;

  // When on pages with a bottom nav bar, raise toast above it (nav ~h-16 = 4rem, + small gap)
  const bottomClass = NAV_BAR_ROUTES.includes(pathname) ? 'bottom-20' : 'bottom-4';

  return (
    <div className={`fixed left-4 ${bottomClass} z-50 flex flex-col gap-2`}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`alert ${
            t.type === 'success'
              ? 'alert-success'
              : t.type === 'error'
                ? 'alert-error'
                : 'alert-info'
          } cursor-pointer shadow-2xl ring-1 ring-base-content/10 max-w-xs`}
          onClick={() => removeToast(t.id)}
        >
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
