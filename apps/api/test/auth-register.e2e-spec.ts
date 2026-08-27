import jwt from "jsonwebtoken";
import request from "supertest";
import {
  type RedisDownHandles,
  type StartedApp,
  startTestApp,
  startTestAppWithRedisDown,
  stopTestApp,
  uniqueEmail,
} from "./helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const REGISTER_PATH = "/api/v1/auth/register";

describe("E2E: POST /api/v1/auth/register (§4, §47 SPEC.md)", () => {
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

  it("E2E-01: успешная регистрация → 201, accessToken, Set-Cookie с refresh token", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const res = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(["accessToken"]);
    expect(typeof res.body.accessToken).toBe("string");

    const accessPayload = jwt.decode(res.body.accessToken) as { typ: string };
    expect(accessPayload.typ).toBe("access");

    const setCookie = res.headers["set-cookie"] as unknown as string[];
    const refreshCookie = setCookie.find((c) => c.startsWith("refresh_token="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("SameSite=Lax");
    expect(refreshCookie).toContain("Path=/api/v1/auth");

    const cookieValue = (refreshCookie as string).split(";")[0];
    const refreshToken = cookieValue.slice("refresh_token=".length);
    const refreshPayload = jwt.decode(refreshToken) as { typ: string };
    expect(refreshPayload.typ).toBe("refresh");
    expect(res.body.accessToken).not.toContain(refreshToken);
  });

  it("E2E-02: повторная регистрация → 409, новый user не создаётся", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const first = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    expect(first.status).toBe(201);

    const second = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({
        email: email.toUpperCase(),
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      });

    expect(second.status).toBe(409);
    expect(second.body.message).toBe("Email already registered");

    const count = await started.prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("E2E-03: невалидный email → 400, user не создаётся", async () => {
    const res = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email: "not-an-email", password: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty("accessToken");

    const user = await started.prisma.user.findUnique({
      where: { email: "not-an-email" },
    });
    expect(user).toBeNull();
  });

  it("E2E-05: невалидный password (min < 12) → 400, user не создаётся", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const res = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({
        email,
        password: "short12char",
        passwordConfirmation: "short12char",
      });

    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty("accessToken");

    const user = await started.prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });

  it("E2E-06: несовпадение паролей → 400 с ошибкой на passwordConfirmation, user не создаётся (§5, §6)", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const res = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({
        email,
        password: PASSWORD,
        passwordConfirmation: "otherPass123",
      });

    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty("accessToken");
    expect(
      (res.body.message as Record<string, string>).passwordConfirmation,
    ).toBe("Пароли не совпадают");

    const user = await started.prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });
});

describe("E2E-04: Redis недоступен (§48 SPEC.md)", () => {
  let handles: RedisDownHandles;

  beforeAll(async () => {
    handles = await startTestAppWithRedisDown();
  });

  afterAll(async () => {
    await stopTestApp(handles);
  });

  it("→ 500, session не создаётся, access token не возвращается, user удалён", async () => {
    const email = uniqueEmail();

    const res = await request(handles.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });

    expect(res.status).toBe(500);
    expect(res.body).not.toHaveProperty("accessToken");
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");

    expect(handles.redisMock.set).toHaveBeenCalledTimes(1);

    const user = await handles.prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });
});
