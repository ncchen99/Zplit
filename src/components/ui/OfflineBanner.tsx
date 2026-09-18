import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { CloudOff as CloudOffIcon } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** 離線時固定顯示於頂端的提示，讓使用者知道目前看到的是本機資料 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[max(env(safe-area-inset-top),0.5rem)]"
    >
      <div className="flex items-center gap-1.5 rounded-full bg-base-content/80 px-3 py-1 text-xs font-medium text-base-100 shadow-md">
        <CloudOffIcon className="h-3.5 w-3.5" />
        {t("common.offlineBanner")}
      </div>
    </div>
  );
}
