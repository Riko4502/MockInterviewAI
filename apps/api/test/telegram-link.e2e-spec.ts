import request from "supertest";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "./helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const REGISTER_PATH = "/api/v1/auth/register";
const TELEGRAM_PATH = "/api/v1/telegram";
const SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY ?? "";
const CHAT_ID_BASE = "900000000";

describe("E2E: Telegram internal API (§6–§7 TELEGRAM_BOT_ARCHITECTURE.md)", () => {
  let started: StartedApp;
  const usedEmails: string[] = [];
  const usedChatIds: string[] = [];

  beforeAll(async () => {
    expect(SERVICE_KEY).toBeTruthy();
    started = await startTestApp();
  });

  afterAll(async () => {
    await started.prisma.user.deleteMany({
      where: {
        OR: [
          { email: { in: usedEmails } },
          { telegramChatId: { in: usedChatIds } },
        ],
      },
    });
    await stopTestApp(started);
  });

  async function registerUser(): Promise<string> {
    const email = uniqueEmail();
    usedEmails.push(email);
    const res = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  }

  function uniqueChatId(): string {
    const chatId = String(CHAT_ID_BASE + usedChatIds.length + 1);
    usedChatIds.push(chatId);
    return chatId;
  }

  it("TG-01: link-token → link → profile → interviews → unlink (полный сценарий)", async () => {
    const accessToken = await registerUser();
    const chatId = uniqueChatId();

    // 1. link-token (Bearer)
    const linkTokenRes = await request(started.app.getHttpServer())
      .post(`${TELEGRAM_PATH}/link-token`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(linkTokenRes.status).toBe(200);
    const { linkUrl } = linkTokenRes.body as { linkUrl: string };
    const rawToken = linkUrl.split("?start=")[1];
    expect(rawToken).toMatch(/^[0-9a-f]{48}$/);

    // 2. link (service key)
    const linkRes = await request(started.app.getHttpServer())
      .post(`${TELEGRAM_PATH}/link`)
      .set("X-Internal-Service-Key", SERVICE_KEY)
      .send({ token: rawToken, chatId });
    expect(linkRes.status).toBe(200);
    expect(linkRes.body.telegramChatId).toBe(chatId);
    expect(linkRes.body.telegramLocale).toBeNull();

    // 3. profile (service key)
    const profileRes = await request(started.app.getHttpServer())
      .get(`${TELEGRAM_PATH}/profile`)
      .query({ chatId })
      .set("X-Internal-Service-Key", SERVICE_KEY);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.telegramChatId).toBe(chatId);
    expect(profileRes.body.email).toContain("@e2e.test");

    // 4. interviews (service key) — сессий у нового пользователя нет
    const interviewsRes = await request(started.app.getHttpServer())
      .get(`${TELEGRAM_PATH}/interviews`)
      .query({ chatId })
      .set("X-Internal-Service-Key", SERVICE_KEY);
    expect(interviewsRes.status).toBe(200);
    expect(interviewsRes.body).toEqual({ items: [] });

    // 5. unlink (service key)
    const unlinkRes = await request(started.app.getHttpServer())
      .post(`${TELEGRAM_PATH}/unlink`)
      .set("X-Internal-Service-Key", SERVICE_KEY)
      .send({ chatId });
    expect(unlinkRes.status).toBe(200);
    expect(unlinkRes.body).toEqual({ success: true });

    // 6. повторный unlink → 404
    const unlinkAgainRes = await request(started.app.getHttpServer())
      .post(`${TELEGRAM_PATH}/unlink`)
      .set("X-Internal-Service-Key", SERVICE_KEY)
      .send({ chatId });
    expect(unlinkAgainRes.status).toBe(404);
  });

  it("TG-02: link без сервисного ключа → 401", async () => {
    const res = await request(started.app.getHttpServer())
      .post(`${TELEGRAM_PATH}/link`)
      .send({ token: "a".repeat(48), chatId: uniqueChatId() });
    expect(res.status).toBe(401);
  });

  it("TG-03: повторный link с тем же токеном → 410 (single-use)", async () => {
    const accessToken = await registerUser();
    const chatId = uniqueChatId();

    const linkTokenRes = await request(started.app.getHttpServer())
      .post(`${TELEGRAM_PATH}/link-token`)
      .set("Authorization", `Bearer ${accessToken}`);
    const rawToken = (linkTokenRes.body as { linkUrl: string }).linkUrl.split(
      "?start=",
    )[1];

    const first = await request(started.app.getHttpServer())
      .post(`${TELEGRAM_PATH}/link`)
      .set("X-Internal-Service-Key", SERVICE_KEY)
      .send({ token: rawToken, chatId });
    expect(first.status).toBe(200);

    const second = await request(started.app.getHttpServer())
      .post(`${TELEGRAM_PATH}/link`)
      .set("X-Internal-Service-Key", SERVICE_KEY)
      .send({ token: rawToken, chatId: uniqueChatId() });
    expect(second.status).toBe(410);
  });

  it("TG-04: profile для несуществующего chatId → 404", async () => {
    const res = await request(started.app.getHttpServer())
      .get(`${TELEGRAM_PATH}/profile`)
      .query({ chatId: "000000000" })
      .set("X-Internal-Service-Key", SERVICE_KEY);
    expect(res.status).toBe(404);
  });
});
