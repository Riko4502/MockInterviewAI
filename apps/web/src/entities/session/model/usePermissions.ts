"use client";

import { SystemPermission, SystemRole } from "@packages/types";
import { hasPermission } from "@packages/utils";
import { useSession } from "./useSession";

export function useRole() {
  return useSession().role;
}

export function useHasRole(allowedRoles: SystemRole | readonly SystemRole[]) {
  const role = useRole();
  const roles =
    typeof allowedRoles === "string" ? [allowedRoles] : allowedRoles;
  return roles.some((allowedRole) => allowedRole === role);
}

export function useIsAdmin() {
  return useHasRole(SystemRole.ADMIN);
}

/** Combined masks require every bit; ADMINISTRATOR matches the server bypass. */
export function useHasPermission(required: bigint) {
  const { isAuthenticated, permissions } = useSession();
  return (
    isAuthenticated &&
    required >= SystemPermission.NONE &&
    hasPermission(permissions, required)
  );
}
