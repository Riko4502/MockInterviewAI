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
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("Integration: вход → PostgreSQL + Redis (§13, §58 SPEC.md)", () => {
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

  it("после login ключ auth:session:{sessionId} существует в Redis с корректным payload", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const registerRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(typeof loginRes.body.accessToken).toBe("string");

    const tokenPayload = jwt.decode(loginRes.body.accessToken) as {
      sub: string;
      sid: string;
    };
    expect(tokenPayload.sid).toMatch(UUID_REGEX);

    const raw = await started.redis.get(`auth:session:${tokenPayload.sid}`);
    expect(raw).not.toBeNull();

    const session = JSON.parse(raw as string) as Record<string, string>;
    expect(session.userId).toBe(tokenPayload.sub);
    expect(session.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(session.tokenFamilyId).toMatch(UUID_REGEX);
    expect(session.createdAt).toBe(session.lastUsedAt);
    expect(session.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("login порождает новую сессию — sid и tokenFamilyId отличаются от регистрации", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const registerRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: PASSWORD });
    expect(loginRes.status).toBe(200);

    const registerPayload = jwt.decode(registerRes.body.accessToken) as {
      sid: string;
    };
    const loginPayload = jwt.decode(loginRes.body.accessToken) as {
      sid: string;
    };

    expect(loginPayload.sid).not.toBe(registerPayload.sid);

    const registerSession = JSON.parse(
      (await started.redis.get(
        `auth:session:${registerPayload.sid}`,
      )) as string,
    ) as { tokenFamilyId: string };
    const loginSession = JSON.parse(
      (await started.redis.get(`auth:session:${loginPayload.sid}`)) as string,
    ) as { tokenFamilyId: string };

    expect(loginSession.tokenFamilyId).not.toBe(registerSession.tokenFamilyId);
  });
});
