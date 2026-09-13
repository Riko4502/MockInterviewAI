"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type PropsWithChildren, useEffect } from "react";
import { useSession } from "@/entities/session";
import { SESSION_STATUS } from "@/entities/session/model/constants";
import { paths } from "@/shared/config";

export type AuthBoundaryMode = "guest" | "protected" | "optional";

export interface AuthBoundaryProps {
  mode: AuthBoundaryMode;
  children: React.ReactNode;
}

export function getSafeReturnTo(returnTo: string | null): string {
  if (!returnTo) {
    return paths.dashboard;
  }

  // Безопасный локальный returnTo: начинается с '/', не с '//', без внешних схем/протоколов
  if (
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes(":") &&
    !returnTo.includes("\\")
  ) {
    return returnTo;
  }

  return paths.dashboard;
}

export function AuthBoundary({
  mode,
  children,
}: PropsWithChildren<AuthBoundaryProps>) {
  const { status, isAuthenticated } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (mode === "protected") {
      if (
        status === SESSION_STATUS.UNAUTHENTICATED ||
        status === SESSION_STATUS.ERROR
      ) {
        const returnTo = pathname ? `?returnTo=${pathname}` : "";
        router.replace(`${paths.login}${returnTo}`);
      }
    } else if (mode === "guest") {
      if (status === SESSION_STATUS.AUTHENTICATED) {
        const rawReturnTo = searchParams?.get("returnTo") ?? null;
        const targetUrl = getSafeReturnTo(rawReturnTo);
        router.replace(targetUrl);
      }
    }
    // mode === "optional": no redirect is performed based on auth state
  }, [mode, status, pathname, searchParams, router]);

  if (status === SESSION_STATUS.INITIALIZING) {
    return (
      <div
        data-testid="auth-boundary-loading"
        className="flex min-h-screen w-full items-center justify-center bg-background"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (mode === "protected") {
    if (!isAuthenticated) {
      return null;
    }
    return <>{children}</>;
  }

  if (mode === "guest") {
    if (isAuthenticated) {
      return null;
    }
    return <>{children}</>;
  }

  // mode === "optional"
  return <>{children}</>;
}
