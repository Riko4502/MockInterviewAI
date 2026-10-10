import type { UserAdminDetailResponseDto } from "@packages/dto";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserDetailsDrawer } from "./UserDetailsDrawer";

const mockUserData: UserAdminDetailResponseDto = {
  id: "user-999",
  email: "developer@example.com",
  role: "USER",
  isActive: true,
  displayName: "Super Dev",
  username: "superdev",
  avatarUrl: null,
  telegramUsername: "superdev_tg",
  gitUrl: "https://github.com/superdev",
  createdAt: "2026-02-15T12:00:00.000Z",
  updatedAt: "2026-02-15T12:00:00.000Z",
  deactivatedAt: null,
  deletedAt: null,
  sessionsCount: 14,
  participationsCount: 8,
};

let mockIsLoading = false;

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    useAdminUsersControllerGetUserById: () => ({
      data: mockUserData,
      isLoading: mockIsLoading,
      isError: false,
    }),
  };
});

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          "admin.users.drawer.title": "Информация о пользователе",
          "admin.users.drawer.userId": "ID пользователя",
          "admin.users.drawer.statsTitle": "Статистика активности",
          "admin.users.drawer.sessionsCount": "Активных сессий",
          "admin.users.drawer.participationsCount": "Участий в интервью",
          "admin.users.drawer.createdAt": "Дата регистрации",
          "admin.users.drawer.telegram": "Telegram",
          "admin.users.drawer.gitUrl": "Git профиль",
          "admin.users.roles.ADMIN": "Администратор",
          "admin.users.roles.USER": "Пользователь",
          "admin.users.statuses.active": "Активен",
          "admin.users.statuses.deactivated": "Деактивирован",
        };
        return translations[key] ?? key;
      },
    }),
  };
});

describe("UserDetailsDrawer", () => {
  it("renders user information and statistics", () => {
    mockIsLoading = false;
    render(
      <UserDetailsDrawer
        userId="user-999"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Информация о пользователе")).toBeDefined();
    expect(screen.getByText("developer@example.com")).toBeDefined();
    expect(screen.getByText("Super Dev")).toBeDefined();
    expect(screen.getByText("@superdev")).toBeDefined();
    expect(screen.getByText("14")).toBeDefined();
    expect(screen.getByText("8")).toBeDefined();
    expect(screen.getByText("@superdev_tg")).toBeDefined();
  });
});
