import { expect, test } from "@playwright/test";
import { paths } from "../src/shared/config";

test.describe("Frontend Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/auth/oauth/providers", (route) =>
      route.fulfill({ json: { github: true } }),
    );
  });

  for (const path of [paths.login, paths.register]) {
    test(`GitHub OAuth is hidden when disabled on ${path}`, async ({
      page,
    }) => {
      await page.route("**/api/v1/auth/oauth/providers", (route) =>
        route.fulfill({ json: { github: false } }),
      );
      const providersResponse = page.waitForResponse(
        "**/api/v1/auth/oauth/providers",
      );
      await page.goto(path);
      await providersResponse;
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByRole("link", { name: /GitHub/ })).toHaveCount(0);
    });
  }

  test("Страница логина открывается, отображает форму и ссылку на регистрацию", async ({
    page,
  }) => {
    await page.goto(paths.login);
    await expect(page).toHaveTitle(/Mock Interview AI/i);
    await expect(
      page.getByRole("heading", { name: "Авторизация" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Продолжить через GitHub", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Пароль")).toBeVisible();
    await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();

    const registerLink = page.getByRole("link", {
      name: "Зарегистрироваться",
    });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute("href", paths.register);
  });

  test("Страница регистрации открывается, отображает форму и ссылку на логин", async ({
    page,
  }) => {
    await page.goto(paths.register);
    await expect(
      page.getByRole("heading", { name: "Регистрация" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Продолжить через GitHub", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Пароль", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Подтверждение пароля")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Зарегистрироваться" }),
    ).toBeVisible();

    const loginLink = page.getByRole("link", { name: "Войти", exact: true });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", paths.login);
  });

  test("Неавторизованный пользователь при попытке открыть дашборд перенаправляется на логин", async ({
    page,
  }) => {
    await page.goto(paths.dashboard);
    await expect(page).toHaveURL(new RegExp(`${paths.login}\\?returnTo=`));
    await expect(
      page.getByRole("heading", { name: "Авторизация" }),
    ).toBeVisible();
  });
});
