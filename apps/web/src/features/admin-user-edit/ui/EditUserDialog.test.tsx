import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser } from "@/entities/admin-user";
import { EditUserDialog } from "./EditUserDialog";

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
  useAdminUsersControllerUpdateUser: () => ({
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
      t: (key: string) => {
        const translations: Record<string, string> = {
          "admin.users.editModal.title": "Редактирование пользователя",
          "admin.users.editModal.submit": "Сохранить изменения",
          "admin.users.editModal.errorToast":
            "Не удалось обновить данные пользователя",
          "admin.users.selfProtection.cannotChangeOwnRole":
            "Нельзя изменить роль собственного аккаунта",
        };
        return translations[key] ?? key;
      },
    }),
  };
});

describe("EditUserDialog", () => {
  const mockUser: AdminUser = {
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
    mockSessionUserId = "admin-123";
  });

  it("disables role selection and shows warning when editing self account", () => {
    render(
      <EditUserDialog user={mockUser} open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByTestId("self-role-warning")).toBeDefined();
    expect(
      screen.getByText("Нельзя изменить роль собственного аккаунта"),
    ).toBeDefined();

    const roleTrigger = screen.getByTestId("edit-user-role-select");
    expect(roleTrigger).toHaveProperty("disabled", true);
  });

  it("enables role selection when editing another user", () => {
    mockSessionUserId = "different-admin";

    render(
      <EditUserDialog user={mockUser} open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.queryByTestId("self-role-warning")).toBeNull();
    const roleTrigger = screen.getByTestId("edit-user-role-select");
    expect(roleTrigger).toHaveProperty("disabled", false);
  });

  it("shows error toast with errorToast title when update fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Network error"));

    render(
      <EditUserDialog user={mockUser} open={true} onOpenChange={vi.fn()} />,
    );

    const submitBtn = screen.getByRole("button", {
      name: "Сохранить изменения",
    });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockToastPush).toHaveBeenCalledWith({
      status: "error",
      title: "Не удалось обновить данные пользователя",
    });
  });
});
