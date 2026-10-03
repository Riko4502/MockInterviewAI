import { Buffer } from "node:buffer";
import { expect, type Page, test } from "@playwright/test";

async function mockDashboard(
  page: Page,
  theme: "light" | "dark",
  delayStats = false,
) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "11111111-1111-4111-8111-111111111111", sid: "dashboard-e2e", typ: "access", permissions: "0", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
  await page.context().addCookies([
    { name: "locale", value: "ru", url: "http://localhost:3000" },
    { name: "theme", value: theme, url: "http://localhost:3000" },
  ]);
  await page.addInitScript((theme) => {
    localStorage.setItem("theme", theme);
  }, theme);
  const long = "LongUnbrokenText".repeat(16);
  const bodies: Record<string, unknown> = {
    "/auth/refresh": { accessToken: token },
    "/profile/me": {
      id: "11111111-1111-4111-8111-111111111111",
      role: "USER",
      permissions: "0",
      theme,
      locale: "ru",
      displayName: long,
      username: null,
      avatarUrl: null,
      email: "test@example.com",
      telegramUsername: null,
      gitUrl: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    "/notifications/unread-count": { count: 0 },
    "/dashboard/readiness": {
      totalPercentage: 40,
      steps: [
        "EMAIL_PROVIDED",
        "MEDIA_CONFIGURED",
        "TELEGRAM_LINKED",
        "SHOWCASE_CREATED",
        "FIRST_MOCK_COMPLETED",
      ].map((key, index) => ({ key, isCompleted: index < 2 })),
    },
    "/dashboard/upcoming": {
      hasUpcoming: true,
      session: {
        id: "room",
        title: long,
        scheduledAt: "2026-10-02T10:00:00Z",
        secondsUntilStart: 7200,
        isReadyToJoin: false,
        status: "WAITING",
        role: "CANDIDATE",
        partner: {
          id: "partner",
          displayName: long,
          avatarUrl: null,
          specialization: "FRONTEND",
          level: "MIDDLE",
        },
      },
    },
    "/dashboard/daily-challenge": {
      problemId: "actual-problem",
      title: long,
      difficulty: "MEDIUM",
      tags: [long, "Graphs", "Recursion", "Extra"],
      timeUntilResetSeconds: 60000,
      isSolvedToday: false,
      solvedAt: null,
      pointsReward: 50,
    },
    "/dashboard/stats": {
      totalInterviews: 12,
      completedInterviews: 9,
      averageScore: 8.6,
      currentStreakDays: 6,
      maxStreakDays: 20,
      solvedTasks: { total: 32, easy: 15, medium: 13, hard: 4 },
      totalPracticeTimeMinutes: 400,
    },
    "/dashboard/insights": {
      insights: [
        {
          id: "one",
          category: "ALGORITHMS",
          headline: long,
          recommendation: `${long} ${"Recommendation from API. ".repeat(25)}`,
          practiceUrl: "/dashboard/sandbox?topic=trees",
        },
      ],
    },
    "/dashboard/recent-sessions": {
      items: [0, 1, 2].map((index) => ({
        id: `${index}`,
        title: long,
        completedAt: "2026-09-28T12:00:00Z",
        durationMinutes: 40,
        score: 8.5,
        role: "INTERVIEWER",
        hasFeedbackReport: false,
      })),
    },
    "/dashboard/match-requests": {
      totalPendingCount: 1,
      items: [
        {
          id: "match",
          senderId: "sender",
          senderName: long,
          skills: [long, "React"],
          specialization: "FRONTEND",
          message: long,
          createdAt: "2026-10-01T10:00:00Z",
        },
      ],
    },
    "/dashboard/showcase-status": {
      hasActiveCard: true,
      card: {
        id: "card",
        specialization: "FRONTEND",
        level: "MIDDLE",
        isUrgent: false,
        daysLeft: 9,
        expiresAt: "2026-10-10T10:00:00Z",
        canBump: false,
        lastBumpedAt: "2026-10-01T10:00:00Z",
        viewsCount: 17,
        incomingRequestsCount: 3,
      },
    },
  };
  let releaseStats: () => void = () => {};
  const statsGate = new Promise<void>((resolve) => {
    releaseStats = resolve;
  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (delayStats && path === "/dashboard/stats") await statsGate;
    if (!(path in bodies)) {
      await route.fulfill({
        status: 404,
        json: { message: "Unmocked endpoint" },
      });
      return;
    }
    await route.fulfill({ json: bodies[path] });
  });
  await page.route("**/sse/notifications", (route) =>
    route.fulfill({ status: 204 }),
  );
  return releaseStats;
}

for (const width of [375, 768, 1280, 1920]) {
  for (const theme of ["light", "dark"] as const) {
    test(`Дашборд ${width} пикселей, ${theme === "light" ? "светлая" : "тёмная"} тема: вёрстка, длинный контент, темы и навигация`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await mockDashboard(page, theme);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto("/dashboard");
      expect(response?.status()).toBe(200);
      await expect(page.getByText("Завершено: 9", { exact: true }))
        .toBeVisible({ timeout: 15000 })
        .catch((error: unknown) => {
          throw new Error(
            `${String(error)}; Browser errors: ${JSON.stringify(errors)}`,
          );
        });
      const primary = page.getByTestId("dashboard-primary");
      const secondary = page.getByTestId("dashboard-secondary");
      await expect(
        primary.getByRole("heading", { name: "Последние интервью" }),
      ).toBeVisible();
      await expect(
        secondary.getByRole("heading", { name: "Моя анкета" }),
      ).toBeVisible();
      const a = await primary.boundingBox();
      const b = await secondary.boundingBox();
      if (!a || !b) throw new Error("Missing dashboard columns");
      if (width < 1024) {
        expect(Math.abs(a.x - b.x)).toBeLessThan(2);
        expect(b.y).toBeGreaterThan(a.y + a.height - 2);
      } else {
        expect(b.x).toBeGreaterThan(a.x + a.width);
        expect(a.width / b.width).toBeGreaterThan(1.9);
        expect(a.width / b.width).toBeLessThan(2.3);
      }
      const overflow = await page.getByTestId("dashboard").evaluate((root) =>
        Array.from(root.querySelectorAll<HTMLElement>("*"))
          .filter((element) => {
            const style = getComputedStyle(element);
            return (
              style.display !== "none" &&
              !element.matches("button") &&
              !element.querySelector("button") &&
              style.overflowX === "visible" &&
              element.clientWidth > 0 &&
              element.scrollWidth > element.clientWidth + 2
            );
          })
          .map((element) => ({
            tag: element.tagName,
            class: element.className,
            width: element.clientWidth,
            scroll: element.scrollWidth,
          })),
      );
      expect(overflow).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /dark/ : /^(?!.*dark)/,
      );
      await expect(
        page.locator('a[href="/dashboard/sandbox?problemId=actual-problem"]'),
      ).toHaveAttribute("href", "/dashboard/sandbox?problemId=actual-problem");
      await expect(
        page.locator('a[href="/dashboard/sandbox?topic=trees"]'),
      ).toHaveAttribute("href", "/dashboard/sandbox?topic=trees");
      await expect(
        page.locator('a[href="/dashboard/sandbox?room=room"]'),
      ).toHaveAttribute("aria-disabled", "true");
      await expect(
        page.getByRole("button", { name: "Поднять в топ" }),
      ).toBeDisabled();
      expect(errors).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`dashboard-${width}-${theme}.png`),
        fullPage: true,
      });
    });
  }
}

test("медленная загрузка статистики не блокирует быстрые действия и другие виджеты; скелетон показателей сохраняет высоту", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const release = await mockDashboard(page, "light", true);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("link", { name: /Песочница кода/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Моя анкета" })).toBeVisible();
  const skeleton = page.getByRole("region", {
    name: "Статистика",
    exact: true,
  });
  await expect(skeleton).toHaveAttribute("aria-busy", "true");
  const before = await skeleton.boundingBox();
  release();
  await expect(page.getByText("Завершено: 9", { exact: true })).toBeVisible();
  const after = await skeleton.boundingBox();
  expect(Math.abs((before?.height ?? 0) - (after?.height ?? 0))).toBeLessThan(
    32,
  );
});
