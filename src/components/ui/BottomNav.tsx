import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  House as HomeIcon,
  Users as UserGroupIcon,
  Wallet as WalletIcon,
  Settings as Cog8ToothIcon,
} from "lucide-react";
import {
  useSwipeProgress,
  type SwipeProgressStore,
} from "@/components/ui/swipeProgress";

const navItems = [
  { key: "home", path: "/home", icon: "home" },
  { key: "groups", path: "/groups", icon: "groups" },
  { key: "personal", path: "/personal", icon: "personal" },
  { key: "settings", path: "/settings", icon: "settings" },
] as const;

function NavIcon({ icon }: { icon: string }) {
  const cls = "h-6 w-6";

  switch (icon) {
    case "home":
      return <HomeIcon className={cls} />;
    case "groups":
      return <UserGroupIcon className={cls} />;
    case "personal":
      return <WalletIcon className={cls} />;
    case "settings":
      return <Cog8ToothIcon className={cls} />;
    default:
      return null;
  }
}

export function BottomNav({ progress }: { progress: SwipeProgressStore }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const swipe = useSwipeProgress(progress);

  const pathIndex = navItems.findIndex(
    (item) =>
      location.pathname === item.path ||
      location.pathname.startsWith(item.path + "/"),
  );
  // 拖曳中就跟著手指走，手指還沒放開也看得出要切到哪一頁
  const position = swipe.dragging ? swipe.index : Math.max(0, pathIndex);

  return (
    <div className="dock dock-sm dock-in-frame border-t border-base-300 bg-base-100 pb-safe">
      {navItems.map((item, i) => {
        // 與目前位置的距離換算成選取程度：1 = 完全選取、0 = 未選取
        const weight = Math.max(0, 1 - Math.abs(i - position));
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            // 圖示與文字都 inherit 這個顏色，拖曳時一起漸變
            style={{
              color: `color-mix(in oklab, var(--color-primary) ${weight * 100}%, var(--color-base-content))`,
              opacity: 0.6 + 0.4 * weight,
              transition: swipe.dragging
                ? "none"
                : "color 200ms ease-out, opacity 200ms ease-out",
            }}
          >
            <NavIcon icon={item.icon} />
            <span className="dock-label text-xs">{t(`nav.${item.key}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
