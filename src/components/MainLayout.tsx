import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/ui/BottomNav";

export function MainLayout() {
  return (
    <div className="relative flex h-full min-h-[inherit] flex-col">
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
