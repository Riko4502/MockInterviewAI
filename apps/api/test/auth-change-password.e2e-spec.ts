import request from "supertest";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "./helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const NEW_PASSWORD = "NewStr0ngPassw0rd!456";
const REGISTER_PATH = "/api/v1/auth/register";
const LOGIN_PATH = "/api/v1/auth/login";
const CHANGE_PASSWORD_PATH = "/api/v1/auth/change-password";

describe("E2E: POST /api/v1/auth/change-password (§67 SPEC.md)", () => {
  let started: StartedApp;
  const usedEmails: string[] = [];

  beforeAll(async () => {
    started = await startTestApp();
  });

  afterAll(async () => {
    await started.prisma.user.deleteMany({
      where: { email: { in: usedEmails } },
    });
    await stopTestApp(started);
  });

  async function register(email: string): Promise<string> {
    const res = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  }

  function extractRefreshCookie(res: {
    headers: Record<string, unknown>;
  }): string | undefined {
    const setCookie = res.headers["set-cookie"] as unknown as string[];
    return setCookie?.find((c) => c.startsWith("refresh_token="));
  }

  it("CP-01: register → change-password → 204, login новым паролем → 200", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const accessToken = await register(email);

    const res = await request(started.app.getHttpServer())
      .post(CHANGE_PASSWORD_PATH)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        newPasswordConfirmation: NEW_PASSWORD,
      });

    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    const clearCookie = extractRefreshCookie(res);
    expect(clearCookie).toBeDefined();
    expect(clearCookie).toContain("refresh_token=;");
    expect(clearCookie).toContain("Expires=Thu, 01 Jan 1970");

    const oldLogin = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.accessToken).toBeDefined();
  });

  it("CP-02: неверный currentPassword → 401, пароль не меняется", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const accessToken = await register(email);

    const res = await request(started.app.getHttpServer())
      .post(CHANGE_PASSWORD_PATH)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        currentPassword: "WrongPassw0rd!000",
        newPassword: NEW_PASSWORD,
        newPasswordConfirmation: NEW_PASSWORD,
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Неверные учётные данные");

    // Пароль не изменился — логин старым паролем проходит.
    const login = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it("CP-03: без access token → 401 (глобальный AccessTokenGuard, §67)", async () => {
    const res = await request(started.app.getHttpServer())
      .post(CHANGE_PASSWORD_PATH)
      .send({
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        newPasswordConfirmation: NEW_PASSWORD,
      });

    expect(res.status).toBe(401);
  });

  it("CP-04: newPassword === currentPassword → 400", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const accessToken = await register(email);

    const res = await request(started.app.getHttpServer())
      .post(CHANGE_PASSWORD_PATH)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: PASSWORD,
        newPasswordConfirmation: PASSWORD,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Новый пароль должен отличаться от текущего");
  });
});
