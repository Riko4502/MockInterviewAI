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
const REFRESH_PATH = "/api/v1/auth/refresh";

function extractRefreshCookie(res: {
  headers: Record<string, unknown>;
}): string | undefined {
  const setCookie = res.headers["set-cookie"] as unknown as string[];
  return setCookie?.find((c) => c.startsWith("refresh_token="));
}

function extractRefreshToken(cookie: string | undefined): string | undefined {
  return cookie?.split(";")[0].slice("refresh_token=".length);
}

describe("E2E: POST /api/v1/auth/refresh (§65 SPEC.md)", () => {
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

  async function registerUser(email: string) {
    const res = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(res.status).toBe(201);
    return res;
  }

  it("R-01: register → refresh → 200, новый accessToken, новый Set-Cookie", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const registerRes = await registerUser(email);
    const registerCookie = extractRefreshCookie(registerRes);
    expect(registerCookie).toBeDefined();

    const refreshToken = extractRefreshToken(registerCookie) as string;

    const refreshRes = await request(started.app.getHttpServer())
      .post(REFRESH_PATH)
      .set("Cookie", `refresh_token=${refreshToken}`);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(typeof refreshRes.body.accessToken).toBe("string");

    const newRefreshCookie = extractRefreshCookie(refreshRes);
    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie).toContain("refresh_token=");
    expect(newRefreshCookie).not.toContain("refresh_token=;");

    const oldSid = (jwt.decode(refreshToken) as unknown as { sid: string }).sid;
    const newRefreshToken = extractRefreshToken(newRefreshCookie) as string;
    const newSid = (jwt.decode(newRefreshToken) as unknown as { sid: string })
      .sid;
    expect(newSid).not.toBe(oldSid);
  });

  it("R-02: refresh с невалидной cookie → 401, clear cookie", async () => {
    const res = await request(started.app.getHttpServer())
      .post(REFRESH_PATH)
      .set("Cookie", "refresh_token=tampered.invalid.token");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");

    const clearCookie = extractRefreshCookie(res);
    expect(clearCookie).toBeDefined();
    expect(clearCookie).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("R-02b: без cookie → 401", async () => {
    const res = await request(started.app.getHttpServer()).post(REFRESH_PATH);

    expect(res.status).toBe(401);
  });

  it("R-03: refresh с уже использованным токеном (replay) → 401, сессия отозвана", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const registerRes = await registerUser(email);
    const registerCookie = extractRefreshCookie(registerRes);
    expect(registerCookie).toBeDefined();

    const refreshToken = extractRefreshToken(registerCookie) as string;

    const firstRefresh = await request(started.app.getHttpServer())
      .post(REFRESH_PATH)
      .set("Cookie", `refresh_token=${refreshToken}`);
    expect(firstRefresh.status).toBe(200);

    const secondRefresh = await request(started.app.getHttpServer())
      .post(REFRESH_PATH)
      .set("Cookie", `refresh_token=${refreshToken}`);
    expect(secondRefresh.status).toBe(401);
    expect(secondRefresh.body.message).toBe("Invalid credentials");

    const clearCookie = extractRefreshCookie(secondRefresh);
    expect(clearCookie).toBeDefined();
    expect(clearCookie).toContain("Expires=Thu, 01 Jan 1970");

    const sid = (jwt.decode(refreshToken) as unknown as { sid: string }).sid;
    expect(await started.redis.get(`auth:session:${sid}`)).toBeNull();
  });
});
