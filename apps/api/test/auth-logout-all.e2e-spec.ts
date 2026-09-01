import jwt from "jsonwebtoken";
import request from "supertest";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "./helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const REGISTER_PATH = "/api/v1/auth/register";
const LOGIN_PATH = "/api/v1/auth/login";
const LOGOUT_ALL_PATH = "/api/v1/auth/logout-all";
const SESSION_PREFIX = "auth:session:";

function extractRefreshCookie(res: {
  headers: Record<string, unknown>;
}): string | undefined {
  const setCookie = res.headers["set-cookie"] as unknown as string[];
  return setCookie?.find((c) => c.startsWith("refresh_token="));
}

describe("E2E: POST /api/v1/auth/logout-all (§66 SPEC.md)", () => {
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

  async function registerAndLogin(email: string, count = 1) {
    const registerRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(registerRes.status).toBe(201);

    const accessTokens: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const loginRes = await request(started.app.getHttpServer())
        .post(LOGIN_PATH)
        .send({ email, password: PASSWORD });
      expect(loginRes.status).toBe(200);
      accessTokens.push(loginRes.body.accessToken as string);
    }
    return accessTokens;
  }

  it("LOA-01: 2 сессии → logout-all → 204, обе сессии удалены, рефреш-cookie сброшена", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const [tokenA, tokenB] = await registerAndLogin(email, 2);
    const keyA = `${SESSION_PREFIX}${(jwt.decode(tokenA) as { sid: string }).sid}`;
    const keyB = `${SESSION_PREFIX}${(jwt.decode(tokenB) as { sid: string }).sid}`;

    expect(await started.redis.get(keyA)).not.toBeNull();
    expect(await started.redis.get(keyB)).not.toBeNull();

    const res = await request(started.app.getHttpServer())
      .post(LOGOUT_ALL_PATH)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    const clearCookie = extractRefreshCookie(res);
    expect(clearCookie).toBeDefined();
    expect(clearCookie).toContain("refresh_token=;");
    expect(clearCookie).toContain("Expires=Thu, 01 Jan 1970");
    expect(clearCookie).toContain("Path=/api/v1/auth");

    expect(await started.redis.get(keyA)).toBeNull();
    expect(await started.redis.get(keyB)).toBeNull();
  });

  it("LOA-02: без access token → 401 (глобальный AccessTokenGuard, §66)", async () => {
    const res = await request(started.app.getHttpServer()).post(
      LOGOUT_ALL_PATH,
    );

    expect(res.status).toBe(401);
  });

  it("LOA-03: access token другого пользователя → его сессии не затрагиваются, 204", async () => {
    const emailA = uniqueEmail();
    const emailB = uniqueEmail();
    usedEmails.push(emailA, emailB);

    const [tokenA] = await registerAndLogin(emailA, 1);
    const [tokenB] = await registerAndLogin(emailB, 1);

    const keyA = `${SESSION_PREFIX}${(jwt.decode(tokenA) as { sid: string }).sid}`;
    const keyB = `${SESSION_PREFIX}${(jwt.decode(tokenB) as { sid: string }).sid}`;

    // B отзывает свои сессии; сессии A не должны затрагиваться.
    const res = await request(started.app.getHttpServer())
      .post(LOGOUT_ALL_PATH)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(204);
    expect(await started.redis.get(keyB)).toBeNull();
    expect(await started.redis.get(keyA)).not.toBeNull();
  });
});
