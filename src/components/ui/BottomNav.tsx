import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  UserGroupIcon,
  PlusIcon,
  WalletIcon,
  Cog8ToothIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  PlusIcon as PlusIconSolid,
  WalletIcon as WalletIconSolid,
  Cog8ToothIcon as Cog8ToothIconSolid,
} from '@heroicons/react/24/solid';

const navItems = [
  { key: 'home', path: '/home', icon: 'home' },
  { key: 'groups', path: '/groups', icon: 'groups' },
  { key: 'add', path: '', icon: 'add' },
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
    case 'add':
      return active
        ? <PlusIconSolid className="h-6 w-6 text-primary-content" />
        : <PlusIcon className="h-6 w-6 text-primary-content" />;
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

  const handleAdd = () => {
    // Navigate to a quick-add route or open modal
    navigate('/groups/new');
  };

  return (
    <div className="dock dock-sm border-t border-base-300 bg-base-100 pb-safe">
      {navItems.map((item) => {
        if (item.key === 'add') {
          return (
            <button
              key={item.key}
              className="relative"
              onClick={handleAdd}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-md -mt-2">
                <NavIcon icon={item.icon} active={false} />
              </div>
              <span className="dock-label text-xs mt-0.5">
                {t(`nav.${item.key}`)}
              </span>
            </button>
          );
        }

        const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
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
