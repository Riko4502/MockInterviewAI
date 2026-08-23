import { expect, test } from "@playwright/test";

test.describe("Frontend Smoke Tests", () => {
  test("Главная страница открывается и содержит ссылки на авторизацию", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Mock Interview AI/i);
    await expect(
      page.getByRole("heading", { name: "Mock Interview AI" }),
    ).toBeVisible();

    const loginLink = page.getByRole("link", { name: "Войти" });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");

    const registerLink = page.getByRole("link", {
      name: "Зарегистрироваться",
    });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute("href", "/register");
  });

  test("Страница логина отображает форму авторизации", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Авторизация" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Пароль")).toBeVisible();
    await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
  });

  test("Страница регистрации отображает форму регистрации", async ({
    page,
  }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Регистрация" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Пароль", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Подтверждение пароля")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Зарегистрироваться" }),
    ).toBeVisible();
  });
});
