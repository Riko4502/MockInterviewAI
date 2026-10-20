import {
  adminUsersControllerGetUserById,
  useAdminUsersControllerGetUsersList,
} from "@packages/api";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserSearch } from "./useUserSearch";

vi.mock("@packages/api", () => ({
  adminUsersControllerGetUserById: vi.fn(),
  adminUsersControllerGetUsersList: vi.fn(),
  useAdminUsersControllerGetUsersList: vi.fn(),
}));

describe("useUserSearch - resolveRecipientIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAdminUsersControllerGetUsersList).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAdminUsersControllerGetUsersList>);
  });

  it("filters out inactive or deleted users and treats them as unresolved", async () => {
    const activeUserId = "11111111-1111-4111-a111-111111111111";
    const inactiveUserId = "22222222-2222-4222-a222-222222222222";
    const deletedUserId = "33333333-3333-4333-a333-333333333333";

    vi.mocked(adminUsersControllerGetUserById).mockImplementation(
      async (id: string) => {
        if (id === activeUserId) {
          return {
            id: activeUserId,
            email: "active@example.com",
            username: "active",
            displayName: "Active User",
            avatarUrl: null,
            role: "user",
            isActive: true,
            deletedAt: null,
            deactivatedAt: null,
            telegramUsername: null,
            gitUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sessionsCount: 0,
            participationsCount: 0,
          };
        }
        if (id === inactiveUserId) {
          return {
            id: inactiveUserId,
            email: "inactive@example.com",
            username: "inactive",
            displayName: "Inactive User",
            avatarUrl: null,
            role: "user",
            isActive: false,
            deletedAt: null,
            deactivatedAt: new Date().toISOString(),
            telegramUsername: null,
            gitUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sessionsCount: 0,
            participationsCount: 0,
          };
        }
        if (id === deletedUserId) {
          return {
            id: deletedUserId,
            email: "deleted@example.com",
            username: "deleted",
            displayName: "Deleted User",
            avatarUrl: null,
            role: "user",
            isActive: true,
            deletedAt: new Date().toISOString(),
            deactivatedAt: null,
            telegramUsername: null,
            gitUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sessionsCount: 0,
            participationsCount: 0,
          };
        }
        throw new Error("Not found");
      },
    );

    const { result } = renderHook(() => useUserSearch("", false));

    const resolution = await result.current.resolveRecipientIds([
      activeUserId,
      inactiveUserId,
      deletedUserId,
    ]);

    expect(resolution.users).toHaveLength(1);
    expect(resolution.users[0].id).toBe(activeUserId);
    expect(resolution.unresolved).toEqual([inactiveUserId, deletedUserId]);
  });
});
