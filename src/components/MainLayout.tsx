import { Outlet } from 'react-router-dom';
import { BottomNav } from '@/components/ui/BottomNav';

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-base-100">
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
