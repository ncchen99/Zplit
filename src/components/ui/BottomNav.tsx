import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { key: 'home', path: '/home', icon: 'home' },
  { key: 'personal', path: '/personal', icon: 'personal' },
  { key: 'add', path: '/expense/new', icon: 'add' },
  { key: 'settings', path: '/settings', icon: 'settings' },
] as const;

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const cls = active ? 'text-primary' : 'text-base-content/60';

  switch (icon) {
    case 'home':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case 'personal':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'add':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    case 'settings':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return null;
  }
}

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="btm-nav btm-nav-sm border-t border-base-300 bg-base-100">
      {navItems.map((item) => {
        const active = location.pathname.startsWith(item.path);
        return (
          <button
            key={item.key}
            className={active ? 'active text-primary' : ''}
            onClick={() => navigate(item.path)}
          >
            <NavIcon icon={item.icon} active={active} />
            <span className={`btm-nav-label text-xs ${active ? 'text-primary' : ''}`}>
              {t(`nav.${item.key}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
