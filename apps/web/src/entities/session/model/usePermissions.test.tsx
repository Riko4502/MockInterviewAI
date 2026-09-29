import { SystemPermission, SystemRole } from "@packages/types";
import { cleanup, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionContext, type SessionContextValue } from "./context";
import {
  useHasPermission,
  useHasRole,
  useIsAdmin,
  useRole,
} from "./usePermissions";

afterEach(cleanup);
function check(
  role: string | null,
  permissions: bigint,
  isAuthenticated = true,
) {
  const value: SessionContextValue = {
    role,
    permissions,
    isAuthenticated,
    userId: isAuthenticated ? "user-1" : null,
    status: isAuthenticated ? "authenticated" : "unauthenticated",
    isProfileLoading: false,
    startSession: vi.fn(),
    clearSession: vi.fn(),
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
  return renderHook(
    () => ({
      role: useRole(),
      admin: useIsAdmin(),
      user: useHasRole(SystemRole.USER),
      read: useHasPermission(SystemPermission.USERS_READ),
      combined: useHasPermission(
        SystemPermission.USERS_READ | SystemPermission.USERS_MANAGE,
      ),
      none: useHasPermission(SystemPermission.NONE),
      negative: useHasPermission(-1n),
    }),
    { wrapper },
  ).result.current;
}
describe("session permission hooks", () => {
  it("recognizes ADMIN and the administrator bypass", () => {
    expect(check(SystemRole.ADMIN, SystemPermission.ADMINISTRATOR)).toEqual({
      role: "ADMIN",
      admin: true,
      user: false,
      read: true,
      combined: true,
      none: true,
      negative: false,
    });
  });
  it("requires every bit in combined permissions", () => {
    expect(check(SystemRole.USER, SystemPermission.USERS_READ)).toMatchObject({
      role: "USER",
      admin: false,
      user: true,
      read: true,
      combined: false,
    });
    expect(
      check(
        SystemRole.USER,
        SystemPermission.USERS_READ | SystemPermission.USERS_MANAGE,
      ).combined,
    ).toBe(true);
  });
  it("does not derive permissions from the role", () => {
    expect(check(SystemRole.ADMIN, 0n)).toMatchObject({
      admin: true,
      read: false,
      combined: false,
    });
  });
  it("denies anonymous access even for an empty mask", () => {
    expect(check(null, 0n, false)).toMatchObject({
      role: null,
      admin: false,
      user: false,
      read: false,
      combined: false,
      none: false,
    });
  });
});
