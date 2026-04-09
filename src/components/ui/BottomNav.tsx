import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  House as HomeIcon,
  Users as UserGroupIcon,
  Wallet as WalletIcon,
  Settings as Cog8ToothIcon,
} from 'lucide-react';

const navItems = [
  { key: 'home', path: '/home', icon: 'home' },
  { key: 'groups', path: '/groups', icon: 'groups' },
  { key: 'personal', path: '/personal', icon: 'personal' },
  { key: 'settings', path: '/settings', icon: 'settings' },
] as const;

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const cls = active ? 'text-primary' : 'text-base-content/60';

  switch (icon) {
    case 'home':
      return <HomeIcon className={`h-6 w-6 ${cls}`} />;
    case 'groups':
      return <UserGroupIcon className={`h-6 w-6 ${cls}`} />;
    case 'personal':
      return <WalletIcon className={`h-6 w-6 ${cls}`} />;
    case 'settings':
      return <Cog8ToothIcon className={`h-6 w-6 ${cls}`} />;
    default:
      return null;
  }
}

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="dock dock-sm border-t border-base-300 bg-base-100 pb-safe">
      {navItems.map((item) => {
        const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
          >
            <NavIcon icon={item.icon} active={active} />
            <span className={`dock-label text-xs ${active ? 'text-primary' : 'text-base-content/60'}`}>
              {t(`nav.${item.key}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
