"use client";

import { defaultLocale, getMessages, type Locale } from "@packages/i18n";
import { LoadingScreen } from "@packages/ui";
import "@/shared/lib/i18n";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type PropsWithChildren, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { SESSION_STATUS } from "@/entities/session/model/constants";
import { paths } from "@/shared/config";

export type AuthBoundaryMode = "guest" | "protected" | "optional";

export interface AuthBoundaryProps {
  mode: AuthBoundaryMode;
  children: React.ReactNode;
}

export function getSafeReturnTo(
  returnTo: string | null,
  fallback: string = paths.dashboard,
): string {
  if (!returnTo) {
    return fallback;
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

  return fallback;
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
        const defaultDestination =
          pathname &&
          (pathname === paths.register || pathname.startsWith(paths.register))
            ? paths.onboarding
            : paths.dashboard;
        const targetUrl = getSafeReturnTo(rawReturnTo, defaultDestination);
        router.replace(targetUrl);
      }
    }
    // mode === "optional": no redirect is performed based on auth state
  }, [mode, status, pathname, searchParams, router]);

  const { i18n } = useTranslation();
  const currentLocale = (i18n.language as Locale) || defaultLocale;
  const t = getMessages(currentLocale).common.loading;

  if (status === SESSION_STATUS.INITIALIZING) {
    return (
      <LoadingScreen
        data-testid="auth-boundary-loading"
        title={t.title}
        badgeText={t.badges.access}
        description={t.descriptions.accessCheck}
        steps={t.steps.accessCheck}
        systemActiveText={t.systemActive}
        brandLabel={t.brandLabel}
      />
    );
  }

  if (mode === "protected") {
    if (!isAuthenticated) {
      return (
        <LoadingScreen
          data-testid="auth-boundary-loading"
          title={t.title}
          badgeText={t.badges.redirect}
          description={t.descriptions.redirectLogin}
          steps={t.steps.redirectLogin}
          systemActiveText={t.systemActive}
          brandLabel={t.brandLabel}
        />
      );
    }
    return <>{children}</>;
  }

  if (mode === "guest") {
    if (isAuthenticated) {
      return (
        <LoadingScreen
          data-testid="auth-boundary-loading"
          title={t.title}
          badgeText={t.badges.redirect}
          description={t.descriptions.redirectDashboard}
          steps={t.steps.redirectDashboard}
          systemActiveText={t.systemActive}
          brandLabel={t.brandLabel}
        />
      );
    }
    return <>{children}</>;
  }

  // mode === "optional"
  return <>{children}</>;
}
