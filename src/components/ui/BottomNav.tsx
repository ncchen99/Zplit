import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  UserGroupIcon,
  WalletIcon,
  Cog8ToothIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  WalletIcon as WalletIconSolid,
  Cog8ToothIcon as Cog8ToothIconSolid,
} from '@heroicons/react/24/solid';

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
      return active ? <HomeIconSolid className={`h-6 w-6 ${cls}`} /> : <HomeIcon className={`h-6 w-6 ${cls}`} />;
    case 'groups':
      return active ? <UserGroupIconSolid className={`h-6 w-6 ${cls}`} /> : <UserGroupIcon className={`h-6 w-6 ${cls}`} />;
    case 'personal':
      return active ? <WalletIconSolid className={`h-6 w-6 ${cls}`} /> : <WalletIcon className={`h-6 w-6 ${cls}`} />;
    case 'settings':
      return active ? <Cog8ToothIconSolid className={`h-6 w-6 ${cls}`} /> : <Cog8ToothIcon className={`h-6 w-6 ${cls}`} />;
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
        const active =
          location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(item.path + '/')) ||
          (item.key === 'groups' && location.pathname.startsWith('/groups'));
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
          >
            <NavIcon icon={item.icon} active={active} />
            <span className="dock-label text-xs">
              {t(`nav.${item.key}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
