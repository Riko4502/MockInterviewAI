"use client";

import type { SystemRole } from "@packages/types";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { SESSION_STATUS, useHasRole, useSession } from "@/entities/session";
import { paths } from "@/shared/config";
import { getSafeReturnTo } from "../session/AuthBoundary";
import { AccessDenied } from "./AccessDenied";

export interface RoleBoundaryProps {
  allowedRoles: readonly SystemRole[];
  children: ReactNode;
  fallback?: ReactNode;
  /** Local destination outside the restricted section. */
  redirectTo?: string;
  /** Вызывается перед перенаправлением при отказе в доступе. */
  onDenied?: () => void;
}

export function RoleBoundary({
  allowedRoles,
  children,
  fallback,
  redirectTo,
  onDenied,
}: RoleBoundaryProps) {
  const { status, isAuthenticated, role, isProfileLoading } = useSession();
  const hasRole = useHasRole(allowedRoles);
  const router = useRouter();
  const pathname = usePathname();
  const lastRedirect = useRef<string | null>(null);
  // Authentication completes before the profile query supplies the role.
  const pending =
    status === SESSION_STATUS.INITIALIZING ||
    (isAuthenticated && role === null && isProfileLoading);
  const allowed =
    status === SESSION_STATUS.AUTHENTICATED && isAuthenticated && hasRole;
  const hasFallback = fallback !== undefined;
  let target = getSafeReturnTo(
    redirectTo ?? (isAuthenticated ? paths.dashboard : paths.login),
  );
  let targetPath =
    new URL(target, "https://local.invalid").pathname.replace(/\/+$/, "") ||
    "/";
  // Guest-only pages would send an authenticated user straight back.
  if (
    isAuthenticated &&
    (targetPath === paths.login || targetPath === paths.register)
  ) {
    target = paths.dashboard;
    targetPath = paths.dashboard;
  }
  const samePage = targetPath === (pathname?.replace(/\/+$/, "") || "/");

  useEffect(() => {
    if (pending || allowed || hasFallback) {
      lastRedirect.current = null;
      return;
    }
    if (!pathname || samePage) return;
    const key = `${pathname}:${target}`;
    if (lastRedirect.current === key) return;
    lastRedirect.current = key;
    onDenied?.();
    router.replace(target);
  }, [
    pending,
    allowed,
    hasFallback,
    pathname,
    samePage,
    target,
    router,
    onDenied,
  ]);

  if (pending) return null;
  if (allowed) return <>{children}</>;
  if (hasFallback) return <>{fallback}</>;
  if (samePage) return <AccessDenied />;
  return null;
}
