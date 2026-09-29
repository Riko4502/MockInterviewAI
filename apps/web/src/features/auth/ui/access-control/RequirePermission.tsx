"use client";

import type { SystemPermission } from "@packages/types";
import type { ReactNode } from "react";
import { useHasPermission } from "@/entities/session";

export interface RequirePermissionProps {
  permission: SystemPermission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({
  permission,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const allowed = useHasPermission(permission);
  return <>{allowed ? children : fallback}</>;
}
