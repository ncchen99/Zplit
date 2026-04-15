import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore, type AuthStatus } from "@/store/authStore";

const publicPaths = ["/login", "/join"];

function isPublicPath(pathname: string) {
  return publicPaths.some((p) => pathname.startsWith(p));
}

function getRedirect(
  status: AuthStatus,
  pathname: string,
  state: unknown,
): string | null {
  switch (status) {
    case "guest":
      return isPublicPath(pathname) ? null : "/login";
    case "onboarding":
      if (pathname === "/onboarding") return null;
      if (pathname.startsWith("/join")) return null;
      return "/onboarding";
    case "ready":
      if (pathname === "/login") {
        // 若登入前有儲存的 redirectTo（例如從 join 頁引導登入），登入後跳回原頁
        const redirectTo = (state as { redirectTo?: string } | null)?.redirectTo;
        if (redirectTo?.startsWith("/")) return redirectTo;
        return "/home";
      }
      if (pathname === "/onboarding") return "/home";
      return null;
    default:
      return null;
  }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center md:min-h-[min(var(--app-frame-height),calc(100vh-2rem))]">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const redirect = getRedirect(status, location.pathname, location.state);
  if (redirect) {
    return <Navigate to={redirect} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
