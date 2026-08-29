import jwt from "jsonwebtoken";
import request from "supertest";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "../helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const REGISTER_PATH = "/api/v1/auth/register";
const LOGIN_PATH = "/api/v1/auth/login";
const REFRESH_PATH = "/api/v1/auth/refresh";

describe("Integration: refresh → Redis (§65 SPEC.md)", () => {
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

  it("после refresh старая сессия удалена из Redis, новая создана, accessToken отличается", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const registerRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: PASSWORD });
    expect(loginRes.status).toBe(200);

    const oldAccessToken = loginRes.body.accessToken as string;
    const oldPayload = jwt.decode(oldAccessToken) as { sid: string };
    const oldSessionKey = `auth:session:${oldPayload.sid}`;
    expect(await started.redis.get(oldSessionKey)).not.toBeNull();

    const refreshToken = (loginRes.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("refresh_token="))
      ?.split(";")[0]
      .slice("refresh_token=".length);
    expect(refreshToken).toBeDefined();

    const refreshRes = await request(started.app.getHttpServer())
      .post(REFRESH_PATH)
      .set("Cookie", `refresh_token=${refreshToken}`);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();

    const newAccessToken = refreshRes.body.accessToken as string;
    expect(newAccessToken).not.toBe(oldAccessToken);

    const newPayload = jwt.decode(newAccessToken) as { sid: string };
    expect(newPayload.sid).not.toBe(oldPayload.sid);

    expect(await started.redis.get(oldSessionKey)).toBeNull();

    const newSessionKey = `auth:session:${newPayload.sid}`;
    expect(await started.redis.get(newSessionKey)).not.toBeNull();
  });
});
