import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser } from "@/entities/admin-user";
import { ToggleStatusDialog } from "./ToggleStatusDialog";

const mockMutateAsync = vi.fn();
const mockToastPush = vi.fn();
const mockInvalidateQueries = vi.fn();
let mockSessionUserId: string | null = "admin-123";

vi.mock("@/entities/session", () => ({
  useSession: () => ({
    userId: mockSessionUserId,
  }),
}));

vi.mock("@packages/api", () => ({
  useAdminUsersControllerUpdateStatus: () => ({
    mutateAsync: mockMutateAsync,
  }),
  getAdminUsersControllerGetUserByIdQueryKey: (id: string) => [
    "/api/v1/admin/users",
    id,
  ],
}));

vi.mock("@packages/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/ui")>();
  return {
    ...actual,
    useToast: () => ({
      push: mockToastPush,
    }),
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, _opts?: { email?: string }) => {
        const translations: Record<string, string> = {
          "admin.users.toggleStatusModal.deactivateTitle":
            "Деактивация пользователя",
          "admin.users.toggleStatusModal.activateTitle":
            "Активация пользователя",
          "admin.users.toggleStatusModal.confirmDeactivate": "Деактивировать",
          "admin.users.toggleStatusModal.confirmActivate": "Активировать",
          "admin.users.selfProtection.cannotDeactivateSelf":
            "Нельзя деактивировать собственный аккаунт администратора",
        };
        return translations[key] ?? key;
      },
    }),
  };
});

describe("ToggleStatusDialog", () => {
  const activeUser: AdminUser = {
    id: "admin-123",
    email: "admin@test.com",
    role: "ADMIN",
    isActive: true,
    displayName: "Admin User",
    username: "admin",
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deactivatedAt: null,
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
    mockSessionUserId = "admin-123";
  });

  it("blocks deactivation of own account", () => {
    render(
      <ToggleStatusDialog
        user={activeUser}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("self-deactivation-warning")).toBeDefined();
    expect(
      screen.getByText(
        "Нельзя деактивировать собственный аккаунт администратора",
      ),
    ).toBeDefined();

    const confirmBtn = screen.getByTestId("toggle-status-confirm-btn");
    expect(confirmBtn).toHaveProperty("disabled", true);
  });

  it("allows deactivation of another active user", async () => {
    mockSessionUserId = "different-admin";

    render(
      <ToggleStatusDialog
        user={activeUser}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("self-deactivation-warning")).toBeNull();
    const confirmBtn = screen.getByTestId("toggle-status-confirm-btn");
    expect(confirmBtn).toHaveProperty("disabled", false);

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "admin-123",
        data: { isActive: false },
      });
    });
  });

  it("allows activating a deactivated user", async () => {
    const inactiveUser = { ...activeUser, isActive: false };

    render(
      <ToggleStatusDialog
        user={inactiveUser}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const confirmBtn = screen.getByTestId("toggle-status-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "admin-123",
        data: { isActive: true },
      });
    });
  });
});
