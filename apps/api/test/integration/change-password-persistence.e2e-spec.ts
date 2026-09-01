import jwt from "jsonwebtoken";
import request from "supertest";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "../helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const NEW_PASSWORD = "NewStr0ngPassw0rd!456";
const REGISTER_PATH = "/api/v1/auth/register";
const LOGIN_PATH = "/api/v1/auth/login";
const CHANGE_PASSWORD_PATH = "/api/v1/auth/change-password";
const SESSION_PREFIX = "auth:session:";

describe("Integration: смена пароля → PostgreSQL + Redis/auth:session:* (§67 SPEC.md)", () => {
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

  it("после change-password: hash обновлён в PostgreSQL, все сессии удалены из Redis, User остаётся", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const registerRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(registerRes.status).toBe(201);

    // Два независимых входа создают две сессии для пользователя.
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

    const changeRes = await request(started.app.getHttpServer())
      .post(CHANGE_PASSWORD_PATH)
      .set("Authorization", `Bearer ${loginA.body.accessToken}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        newPasswordConfirmation: NEW_PASSWORD,
      });
    expect(changeRes.status).toBe(204);

    // Все сессии (включая текущую) отозваны из Redis.
    expect(await started.redis.get(keyA)).toBeNull();
    expect(await started.redis.get(keyB)).toBeNull();

    // Пароль в PostgreSQL обновлён: логин старым паролем отклоняется,
    // новым — проходит.
    const oldLogin = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.accessToken).toBeDefined();

    // Сам пользователь остаётся в PostgreSQL.
    const user = await started.prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
  });
});
