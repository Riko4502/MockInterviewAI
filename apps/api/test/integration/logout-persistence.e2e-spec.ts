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
const LOGOUT_PATH = "/api/v1/auth/logout";

describe("Integration: выход → Redis (§60 SPEC.md)", () => {
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

  it("после logout ключ auth:session:{sessionId} удалён из Redis, User остаётся в PostgreSQL", async () => {
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

    const tokenPayload = jwt.decode(loginRes.body.accessToken) as {
      sid: string;
    };
    const sessionKey = `auth:session:${tokenPayload.sid}`;
    expect(await started.redis.get(sessionKey)).not.toBeNull();

    const refreshToken = (loginRes.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("refresh_token="))
      ?.split(";")[0]
      .slice("refresh_token=".length);
    expect(refreshToken).toBeDefined();

    const logoutRes = await request(started.app.getHttpServer())
      .post(LOGOUT_PATH)
      .set("Cookie", `refresh_token=${refreshToken}`);
    expect(logoutRes.status).toBe(204);

    expect(await started.redis.get(sessionKey)).toBeNull();

    // logout не удаляет пользователя
    const user = await started.prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
  });
});
