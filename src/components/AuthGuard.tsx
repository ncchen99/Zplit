import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore, type AuthStatus } from "@/store/authStore";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

const publicPaths = ["/login", "/join"];

/**
 * 可用邀請連結唯讀預覽的頁面：群組頁與單筆帳務頁。
 * 只在網址帶著 ?invite=<邀請碼> 時放行，實際的邀請碼比對由頁面負責，
 * 資料權限則由 Firestore Rules 把關。
 */
const previewPaths = /^\/groups\/[^/]+(\/expenses\/[^/]+)?$/;

function isPublicPath(pathname: string) {
  return publicPaths.some((p) => pathname.startsWith(p));
}

function isInvitePreview(pathname: string, search: string) {
  return (
    previewPaths.test(pathname) && !!new URLSearchParams(search).get("invite")
  );
}

function getRedirect(
  status: AuthStatus,
  pathname: string,
  search: string,
  state: unknown,
): string | null {
  switch (status) {
    case "guest":
      return isPublicPath(pathname) || isInvitePreview(pathname, search)
        ? null
        : "/login";
    case "onboarding":
      if (pathname === "/onboarding") return null;
      if (pathname.startsWith("/join")) return null;
      if (isInvitePreview(pathname, search)) return null;
      return "/onboarding";
    case "ready":
      if (pathname === "/login" || pathname === "/onboarding") {
        // 若之前有儲存的 redirectTo，登入/註冊後跳回原頁
        const redirectTo = (state as { redirectTo?: string } | null)?.redirectTo;
        if (redirectTo?.startsWith("/") && redirectTo !== "/onboarding") {
          return redirectTo;
        }
        return "/home";
      }
      return null;
    default:
      return null;
  }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading") {
    return <PageSkeleton />;
  }

  const redirect = getRedirect(
    status,
    location.pathname,
    location.search,
    location.state,
  );
  if (redirect) {
    return (
      <Navigate
        to={redirect}
        state={{
          from: location,
          ...(typeof location.state === "object" ? location.state : {}),
        }}
        replace
      />
    );
  }

  return <>{children}</>;
}
