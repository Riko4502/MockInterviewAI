import { Buffer } from "node:buffer";
import type { UserProfileDto } from "@packages/api";
import { expect, type Page, test } from "@playwright/test";
import { paths } from "../src/shared/config";

const userId = "11111111-1111-4111-8111-111111111111";

async function mockSession(page: Page, role: "USER" | "ADMIN") {
  const iat = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  // Токен используется только браузерным моком API, а не настоящим сервером.
  const accessToken = [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({
      sub: userId,
      sid: "e2e-session",
      typ: "access",
      permissions: "0",
      iat,
      exp: iat + 3600,
    }),
    "e2e-signature",
  ].join(".");
  const profile: UserProfileDto = {
    id: userId,
    role,
    permissions: "0",
    theme: "system",
    locale: "ru",
    email: "access-control@example.com",
    displayName: "Тестовый пользователь",
    username: null,
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({ json: { accessToken } }),
  );
  await page.route("**/api/v1/profile/me", (route) =>
    route.fulfill({ json: profile }),
  );
  await page.route("**/api/v1/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  // 204 останавливает SSE-подключение без повторов и отзыва сессии.
  await page.route("**/sse/notifications", (route) =>
    route.fulfill({ status: 204 }),
  );
}

test.describe("Контроль доступа", () => {
  test("Перенаправляет USER с /admin/users на /dashboard и показывает Toast", async ({
    page,
  }) => {
    await mockSession(page, "USER");
    await page.goto(paths.adminUsers);
    await expect(page).toHaveURL(new RegExp(`${paths.dashboard}$`));
    const toast = page.locator('[data-slot="toast"]');
    await expect(toast).toHaveCount(1);
    await expect(page.getByTestId("dashboard")).toBeVisible();
    await expect(toast).toContainText("Недостаточно прав");
    await expect(toast).toContainText(
      "У вас нет прав для выполнения этого действия.",
    );
    await expect(
      page.getByRole("heading", { name: "Пользователи", exact: true }),
    ).toHaveCount(0);
  });

  test("Открывает /admin/users для ADMIN", async ({ page }) => {
    await mockSession(page, "ADMIN");
    const response = await page.goto(paths.adminUsers);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Пользователи", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Тестовый пользователь/ }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${paths.adminUsers}$`));
    await expect(page.locator('[data-slot="toast"]')).toHaveCount(0);
  });

  test("Не показывает USER административные ссылки в сайдбаре", async ({
    page,
  }) => {
    await mockSession(page, "USER");
    await page.goto(paths.dashboard);
    // Ждём загрузки профиля, чтобы отсутствие ссылок не проверялось на пустой странице.
    await expect(
      page.getByRole("button", { name: /Тестовый пользователь/ }),
    ).toBeVisible();
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(
      sidebar.getByRole("link", { name: "Панель управления" }),
    ).toBeVisible();
    await expect(sidebar.locator('a[href^="/admin"]')).toHaveCount(0);
    await expect(
      sidebar.getByText("Администрирование", { exact: true }),
    ).toHaveCount(0);
  });

  test("Показывает Toast при ответе API 403 и сохраняет работоспособность страницы", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await mockSession(page, "USER");
    await page.route("**/api/v1/notifications?*", (route) =>
      route.fulfill({
        status: 403,
        json: { statusCode: 403, message: "Forbidden" },
      }),
    );
    await page.goto(paths.dashboard);
    await expect(
      page.getByRole("button", { name: /Тестовый пользователь/ }),
    ).toBeVisible();
    const forbiddenResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/notifications" &&
        response.status() === 403,
    );
    await page
      .getByRole("button", { name: "Уведомления", exact: true })
      .click();
    await forbiddenResponse;
    await expect(page.locator('[data-slot="toast"]')).toContainText(
      "Недостаточно прав",
    );
    await expect(page).toHaveURL(new RegExp(`${paths.dashboard}$`));
    await expect(page.getByTestId("dashboard")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Тестовый пользователь/ }).click();
    await expect(
      page.getByRole("menuitem", { name: "Настройки", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Выйти" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
