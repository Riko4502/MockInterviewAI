import { Buffer } from "node:buffer";
import type { UserAdminResponseDto, UserProfileDto } from "@packages/api";
import { expect, type Page, test } from "@playwright/test";
import { paths } from "../src/shared/config";

const adminId = "11111111-1111-4111-8111-111111111111";

async function mockAdminSession(page: Page) {
  const iat = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({
      sub: adminId,
      sid: "e2e-session",
      typ: "access",
      permissions: "0",
      iat,
      exp: iat + 3600,
    }),
    "e2e-signature",
  ].join(".");

  const profile: UserProfileDto = {
    id: adminId,
    role: "ADMIN",
    permissions: "0",
    theme: "system",
    locale: "ru",
    email: "admin@example.com",
    displayName: "Главный Администратор",
    username: "superadmin",
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const mockUsers: UserAdminResponseDto[] = [
    {
      id: adminId,
      email: "admin@example.com",
      username: "superadmin",
      displayName: "Главный Администратор",
      role: "ADMIN",
      isActive: true,
      telegramUsername: null,
      gitUrl: null,
      avatarUrl: null,
      deactivatedAt: null,
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "candidate@example.com",
      username: "candidate_alex",
      displayName: "Алексей Иванов",
      role: "USER",
      isActive: true,
      telegramUsername: "alex_tg",
      gitUrl: null,
      avatarUrl: null,
      deactivatedAt: null,
      deletedAt: null,
      createdAt: "2026-02-15T10:00:00Z",
      updatedAt: "2026-02-15T10:00:00Z",
    },
  ];

  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({ json: { accessToken } }),
  );
  await page.route("**/api/v1/profile/me", (route) =>
    route.fulfill({ json: profile }),
  );
  await page.route("**/api/v1/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/sse/notifications", (route) =>
    route.fulfill({ status: 204 }),
  );

  await page.route("**/api/v1/admin/users*", (route) => {
    return route.fulfill({
      json: {
        items: mockUsers,
        meta: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });
  });
}

test.describe("Админ-панель: Управление пользователями", () => {
  test("Отображает список пользователей и элементы управления", async ({
    page,
  }) => {
    await mockAdminSession(page);
    await page.goto(paths.adminUsers);

    // Заголовок и кнопка создания
    await expect(
      page.getByRole("heading", {
        name: "Управление пользователями",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Добавить пользователя" }),
    ).toBeVisible();

    // Пользователи отображаются в таблице
    const table = page.getByTestId("admin-users-table");
    await expect(table.getByText("admin@example.com")).toBeVisible();
    await expect(table.getByText("candidate@example.com")).toBeVisible();
    await expect(table.getByText("Главный Администратор")).toBeVisible();
    await expect(table.getByText("Алексей Иванов")).toBeVisible();
  });

  test("Открывает модальное окно создания пользователя", async ({ page }) => {
    await mockAdminSession(page);
    await page.goto(paths.adminUsers);

    await page.getByRole("button", { name: "Добавить пользователя" }).click();

    await expect(
      page.getByRole("heading", { name: "Добавить нового пользователя" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Роль")).toBeVisible();
  });
});
