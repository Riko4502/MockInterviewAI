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
const LOGOUT_ALL_PATH = "/api/v1/auth/logout-all";
const SESSION_PREFIX = "auth:session:";

describe("Integration: отзыв всех сессий → Redis/auth:session:* (§66 SPEC.md)", () => {
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

  it("после logout-all все auth:session:* ключи пользователя удалены, User остаётся в PostgreSQL", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const registerRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(registerRes.status).toBe(201);

    // Два параллельных входа создают две независимые сессии для пользователя.
    const [loginA, loginB] = await Promise.all([
      request(started.app.getHttpServer())
        .post(LOGIN_PATH)
        .send({ email, password: PASSWORD }),
      request(started.app.getHttpServer())
        .post(LOGIN_PATH)
        .send({ email, password: PASSWORD }),
    ]);
    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);

    const sidA = (jwt.decode(loginA.body.accessToken) as { sid: string }).sid;
    const sidB = (jwt.decode(loginB.body.accessToken) as { sid: string }).sid;
    const keyA = `${SESSION_PREFIX}${sidA}`;
    const keyB = `${SESSION_PREFIX}${sidB}`;

    expect(await started.redis.get(keyA)).not.toBeNull();
    expect(await started.redis.get(keyB)).not.toBeNull();

    const logoutAllRes = await request(started.app.getHttpServer())
      .post(LOGOUT_ALL_PATH)
      .set("Authorization", `Bearer ${loginA.body.accessToken}`);
    expect(logoutAllRes.status).toBe(204);

    expect(await started.redis.get(keyA)).toBeNull();
    expect(await started.redis.get(keyB)).toBeNull();

    // logout-all не удаляет самого пользователя из PostgreSQL
    const user = await started.prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
  });
});
