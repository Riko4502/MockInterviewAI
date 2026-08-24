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

function extractRefreshCookie(res: {
  headers: Record<string, unknown>;
}): string | undefined {
  const setCookie = res.headers["set-cookie"] as unknown as string[];
  return setCookie?.find((c) => c.startsWith("refresh_token="));
}

describe("E2E: POST /api/v1/auth/login (§58–§59 SPEC.md)", () => {
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

  async function login(body: Record<string, string>) {
    return request(started.app.getHttpServer()).post(LOGIN_PATH).send(body);
  }

  async function registerUser(email: string) {
    const res = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD });
    expect(res.status).toBe(201);
    return res;
  }

  it("L-01: register → login → 200 { accessToken }, новый Set-Cookie", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const registerRes = await registerUser(email);
    const registerCookie = extractRefreshCookie(registerRes);
    expect(registerCookie).toBeDefined();

    const res = await login({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["accessToken"]);
    expect(typeof res.body.accessToken).toBe("string");

    const loginCookie = extractRefreshCookie(res);
    expect(loginCookie).toBeDefined();
    expect(loginCookie).toContain("HttpOnly");
    expect(loginCookie).toContain("SameSite=Lax");
    expect(loginCookie).toContain("Path=/api/v1/auth");

    // каждый логин порождает новую сессию → новый refresh token
    expect(loginCookie).not.toBe(registerCookie);
    // refresh token не возвращается в JSON (§45)
    expect(JSON.stringify(res.body)).not.toContain(
      loginCookie?.split(";")[0].slice("refresh_token=".length),
    );
  });

  it("L-02: неверный пароль → 401 generic, Set-Cookie отсутствует", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);
    await registerUser(email);

    const res = await login({ email, password: WRONG_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
    expect(extractRefreshCookie(res)).toBeUndefined();
  });

  it("L-03: неизвестный email → 401, тело байт-в-байт как у неверного пароля (§59)", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);
    await registerUser(email);

    const wrongPassword = await login({ email, password: WRONG_PASSWORD });
    const unknownEmail = await login({
      email: uniqueEmail(),
      password: WRONG_PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(JSON.stringify(unknownEmail.body)).toBe(
      JSON.stringify(wrongPassword.body),
    );
    expect(extractRefreshCookie(unknownEmail)).toBeUndefined();
  });

  it("L-04: невалидный email / пустой password → 400", async () => {
    const invalidEmail = await login({
      email: "not-an-email",
      password: PASSWORD,
    });
    expect(invalidEmail.status).toBe(400);
    expect(invalidEmail.body).not.toHaveProperty("accessToken");

    const emptyPassword = await login({ email: uniqueEmail(), password: "" });
    expect(emptyPassword.status).toBe(400);
    expect(emptyPassword.body).not.toHaveProperty("accessToken");
  });
});
