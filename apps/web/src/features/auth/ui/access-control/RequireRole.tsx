"use client";

import type { SystemRole } from "@packages/types";
import type { ReactNode } from "react";
import { useHasRole } from "@/entities/session";

export interface RequireRoleProps {
  allowedRoles: readonly SystemRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({
  allowedRoles,
  children,
  fallback = null,
}: RequireRoleProps) {
  const allowed = useHasRole(allowedRoles);
  return <>{allowed ? children : fallback}</>;
}
