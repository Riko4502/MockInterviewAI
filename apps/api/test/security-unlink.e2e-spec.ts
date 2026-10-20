import { createHash, randomInt } from "node:crypto";
import request from "supertest";
import {
  deleteUsersWithSecurityEvents,
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "./helpers/test-app.helper";

/**
 * E2E-проверки безопасной отвязки аккаунтов (ADR-005, plan §5).
 *
 * Работают на реальных PostgreSQL и Redis (Docker). Код отвязки в Redis
 * засевается напрямую: путь `request` публикует код в RabbitMQ, и полный
 * флоу через бота здесь не воспроизводится — проверяется серверная часть
 * `confirm` (сравнение хеша, лимит попыток, ревокация, аудит).
 */
const PASSWORD = "Str0ngPassw0rd!123";
const REGISTER_PATH = "/api/v1/auth/register";
const PROFILE_PATH = "/api/v1/profile/me";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Уникальный `telegramChatId` для теста.
 *
 * Диапазон (`7` + 10 цифр) выбран так, чтобы не пересекаться с базой
 * `telegram-link.e2e-spec.ts` (`90000000x`): `telegram_chat_id` уникален, и
 * при параллельном прогоне спека с общими id падала бы на чужом пользователе.
 */
function uniqueChatId(): string {
  return `7${randomInt(1_000_000_000, 9_999_999_999)}`;
}

describe("E2E: безопасная отвязка Telegram/GitHub (ADR-005)", () => {
  let started: StartedApp;
  const userIds: string[] = [];

  beforeAll(async () => {
    started = await startTestApp();
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      // `SecurityEvent.userId` — ON DELETE RESTRICT (D12): события сносятся
      // до пользователя, как и в `user-cleanup.cron`.
      await deleteUsersWithSecurityEvents(started.prisma, {
        id: { in: userIds },
      });
    }
    await stopTestApp(started);
  });

  interface RegisteredUser {
    id: string;
    email: string;
    accessToken: string;
  }

  async function registerUser(): Promise<RegisteredUser> {
    const email = uniqueEmail();
    const res = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(res.status).toBe(201);
    const accessToken = res.body.accessToken as string;

    const profile = await request(started.app.getHttpServer())
      .get(PROFILE_PATH)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(profile.status).toBe(200);

    const id = profile.body.id as string;
    userIds.push(id);
    return { id, email, accessToken };
  }

  function seedUnlinkCode(userId: string, code: string, ttlMs = 600_000) {
    return started.redis.set(
      `telegram:unlink:${userId}`,
      JSON.stringify({
        hash: sha256(code),
        attempts: 0,
        expiresAt: Date.now() + ttlMs,
      }),
      600,
    );
  }

  it("GitHub: успешная отвязка сбрасывает привязку, инкрементирует generation, пишет аудит и отзывает токен", async () => {
    const user = await registerUser();
    await started.prisma.user.update({
      where: { id: user.id },
      data: { githubId: "gh-e2e-1", gitUrl: "https://github.com/e2e_user" },
    });

    const res = await request(started.app.getHttpServer())
      .post("/api/v1/profile/me/github/unlink")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .set("User-Agent", "e2e-suite");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const dbUser = await started.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        githubId: true,
        gitUrl: true,
        generation: true,
      },
    });
    expect(dbUser.githubId).toBeNull();
    expect(dbUser.gitUrl).toBeNull();
    expect(dbUser.generation).toBe(2);

    const events = await started.prisma.securityEvent.findMany({
      where: { userId: user.id },
      select: { type: true, userAgent: true, ipAddress: true },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "GITHUB_UNLINKED",
      userAgent: "e2e-suite",
    });

    // generation++ отзывает прежние access-токены (revocation через guard).
    const afterUnlink = await request(started.app.getHttpServer())
      .get(PROFILE_PATH)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(afterUnlink.status).toBe(401);
  }, 30_000);

  it("GitHub: 400 GITHUB_NOT_LINKED без привязки", async () => {
    const user = await registerUser();

    const res = await request(started.app.getHttpServer())
      .post("/api/v1/profile/me/github/unlink")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("GITHUB_NOT_LINKED");
  }, 30_000);

  it("GitHub: 409 LAST_AUTH_METHOD, когда GitHub — единственный способ входа", async () => {
    const user = await registerUser();
    await started.prisma.user.update({
      where: { id: user.id },
      data: { githubId: "gh-e2e-2", passwordHash: null },
    });

    const res = await request(started.app.getHttpServer())
      .post("/api/v1/profile/me/github/unlink")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("LAST_AUTH_METHOD");
  }, 30_000);

  it("D2: PATCH /profile/me отклоняет обнуление telegramUsername и gitUrl, остальные поля работают", async () => {
    const user = await registerUser();

    const forbiddenTg = await request(started.app.getHttpServer())
      .patch(PROFILE_PATH)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ telegramUsername: null });
    expect(forbiddenTg.status).toBe(400);

    const forbiddenGit = await request(started.app.getHttpServer())
      .patch(PROFILE_PATH)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ gitUrl: null });
    expect(forbiddenGit.status).toBe(400);

    const allowed = await request(started.app.getHttpServer())
      .patch(PROFILE_PATH)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ displayName: "E2E Renamed" });
    expect(allowed.status).toBe(200);
    expect(allowed.body.displayName).toBe("E2E Renamed");
  }, 30_000);

  it("Telegram request: 400 TELEGRAM_NOT_LINKED без привязки", async () => {
    const user = await registerUser();

    const res = await request(started.app.getHttpServer())
      .post("/api/v1/profile/me/telegram/unlink/request")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("TELEGRAM_NOT_LINKED");
  }, 30_000);

  it("Telegram confirm: успешный код отвязывает, инкрементирует generation и пишет TG_UNLINKED", async () => {
    const user = await registerUser();
    await started.prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId: BigInt(randomInt(100_000_000, 999_999_999)),
        telegramChatId: uniqueChatId(),
        telegramLinkVerified: true,
      },
    });
    await seedUnlinkCode(user.id, "123456");

    const res = await request(started.app.getHttpServer())
      .post("/api/v1/profile/me/telegram/unlink/confirm")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ code: "123456" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const dbUser = await started.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        telegramId: true,
        telegramChatId: true,
        telegramLinkVerified: true,
        generation: true,
      },
    });
    expect(dbUser.telegramId).toBeNull();
    expect(dbUser.telegramChatId).toBeNull();
    expect(dbUser.telegramLinkVerified).toBe(false);
    expect(dbUser.generation).toBe(2);

    const events = await started.prisma.securityEvent.findMany({
      where: { userId: user.id, type: "TG_UNLINKED" },
    });
    expect(events).toHaveLength(1);

    // Код одноразовый: запись изъята сравнением-и-удалением.
    expect(await started.redis.get(`telegram:unlink:${user.id}`)).toBeNull();
  }, 30_000);

  it("Telegram confirm: неверный код → 400 INVALID_CODE, верный код после этого ещё работает", async () => {
    const user = await registerUser();
    await started.prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: uniqueChatId(), telegramLinkVerified: true },
    });
    await seedUnlinkCode(user.id, "654321");

    const wrong = await request(started.app.getHttpServer())
      .post("/api/v1/profile/me/telegram/unlink/confirm")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ code: "000000" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe("INVALID_CODE");

    // Неверная попытка не «сжигает» код: лимит позволяет ввести верный.
    const right = await request(started.app.getHttpServer())
      .post("/api/v1/profile/me/telegram/unlink/confirm")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ code: "654321" });
    expect(right.status).toBe(200);
  }, 30_000);

  it("Telegram confirm: 410 CODE_EXPIRED без записи в Redis", async () => {
    const user = await registerUser();
    await started.prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: uniqueChatId(), telegramLinkVerified: true },
    });

    const res = await request(started.app.getHttpServer())
      .post("/api/v1/profile/me/telegram/unlink/confirm")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ code: "123456" });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("CODE_EXPIRED");
  }, 30_000);

  it("Security events: непросмотренное событие отдаётся in-app и снимается отметкой «просмотрено»", async () => {
    const user = await registerUser();
    await started.prisma.user.update({
      where: { id: user.id },
      data: { githubId: "gh-e2e-3", gitUrl: "https://github.com/e2e_3" },
    });

    const unlink = await request(started.app.getHttpServer())
      .post("/api/v1/profile/me/github/unlink")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(unlink.status).toBe(200);

    // Токен отозван, поэтому читаем список после повторного входа.
    const login = await request(started.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });
    expect(login.status).toBe(200);
    const freshToken = login.body.accessToken as string;

    const list = await request(started.app.getHttpServer())
      .get("/api/v1/profile/me/security-events")
      .set("Authorization", `Bearer ${freshToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const event = list.body.items[0] as { id: string; type: string };
    expect(event.type).toBe("GITHUB_UNLINKED");
    // Приватные поля не утекают в публичный DTO (ADR-005:128).
    expect(event).not.toHaveProperty("ipAddress");
    expect(event).not.toHaveProperty("userAgent");
    expect(event).not.toHaveProperty("metadata");

    const seen = await request(started.app.getHttpServer())
      .post(`/api/v1/profile/me/security-events/${event.id}/seen`)
      .set("Authorization", `Bearer ${freshToken}`);
    expect(seen.status).toBe(200);
    expect(seen.body).toEqual({ success: true });

    const listAfter = await request(started.app.getHttpServer())
      .get("/api/v1/profile/me/security-events")
      .set("Authorization", `Bearer ${freshToken}`);
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.items).toHaveLength(0);
  }, 30_000);
});
