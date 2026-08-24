import jwt from "jsonwebtoken";
import request from "supertest";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "./helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const WRONG_PASSWORD = "Wr0ngPassw0rd!456";
const REGISTER_PATH = "/api/v1/auth/register";
const LOGIN_PATH = "/api/v1/auth/login";
const LOGOUT_PATH = "/api/v1/auth/logout";

function extractRefreshCookie(res: {
  headers: Record<string, unknown>;
}): string | undefined {
  const setCookie = res.headers["set-cookie"] as unknown as string[];
  return setCookie?.find((c) => c.startsWith("refresh_token="));
}

describe("E2E: POST /api/v1/auth/logout (§60 SPEC.md)", () => {
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

  async function registerAndLogin(email: string) {
    const registerRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: PASSWORD });
    expect(loginRes.status).toBe(200);

    const refreshToken = extractRefreshCookie(loginRes)
      ?.split(";")[0]
      .slice("refresh_token=".length);
    expect(refreshToken).toBeDefined();

    return { accessToken: loginRes.body.accessToken as string, refreshToken };
  }

  it("LO-01: logout с валидной cookie → 204, Set-Cookie сброса, session удалена из Redis", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const { accessToken, refreshToken } = await registerAndLogin(email);

    const sid = (jwt.decode(accessToken) as { sid: string }).sid;
    const sessionKey = `auth:session:${sid}`;
    expect(await started.redis.get(sessionKey)).not.toBeNull();

    const res = await request(started.app.getHttpServer())
      .post(LOGOUT_PATH)
      .set("Cookie", `refresh_token=${refreshToken}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    const clearCookie = extractRefreshCookie(res);
    expect(clearCookie).toBeDefined();
    expect(clearCookie).toContain("refresh_token=;");
    expect(clearCookie).toContain("Expires=Thu, 01 Jan 1970");
    expect(clearCookie).toContain("Path=/api/v1/auth");

    expect(await started.redis.get(sessionKey)).toBeNull();
  });

  it("LO-02: без cookie → 401", async () => {
    const res = await request(started.app.getHttpServer()).post(LOGOUT_PATH);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("LO-03: подделанная cookie → 401, clearCookie присутствует", async () => {
    const res = await request(started.app.getHttpServer())
      .post(LOGOUT_PATH)
      .set("Cookie", "refresh_token=tampered.invalid.token");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");

    const clearCookie = extractRefreshCookie(res);
    expect(clearCookie).toBeDefined();
    expect(clearCookie).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("LO-04: повторный logout с тем же токеном после успешного выхода → 401, cookie сброшен", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const { refreshToken } = await registerAndLogin(email);

    const first = await request(started.app.getHttpServer())
      .post(LOGOUT_PATH)
      .set("Cookie", `refresh_token=${refreshToken}`);
    expect(first.status).toBe(204);

    // строгая семантика §60: сессия уже отозвана — повторный logout отклоняется
    const second = await request(started.app.getHttpServer())
      .post(LOGOUT_PATH)
      .set("Cookie", `refresh_token=${refreshToken}`);

    expect(second.status).toBe(401);
    expect(second.body.message).toBe("Invalid credentials");
    expect(extractRefreshCookie(second)).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("logout с невалидным refresh token другого типа (access JWT) → 401", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const { accessToken } = await registerAndLogin(email);

    const res = await request(started.app.getHttpServer())
      .post(LOGOUT_PATH)
      .set("Cookie", `refresh_token=${accessToken}`);

    expect(res.status).toBe(401);
  });

  it("logout с валидным JWT несуществующей сессии → 401", async () => {
    const res = await request(started.app.getHttpServer())
      .post(LOGOUT_PATH)
      .set(
        "Cookie",
        `refresh_token=${WRONG_PASSWORD}.${PASSWORD}.forged-signature`,
      );

    expect(res.status).toBe(401);
  });
});
