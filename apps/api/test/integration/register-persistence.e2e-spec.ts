import jwt from "jsonwebtoken";
import request from "supertest";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "../helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("Integration: регистрация → PostgreSQL + Redis (§13, §48 SPEC.md)", () => {
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

  it("после успешной регистрации User существует в PostgreSQL", async () => {
    const mixedCaseEmail = uniqueEmail().toUpperCase();
    usedEmails.push(mixedCaseEmail.toLowerCase());

    const res = await request(started.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: mixedCaseEmail,
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      });

    expect(res.status).toBe(201);
    expect(typeof res.body.accessToken).toBe("string");

    const user = await started.prisma.user.findUnique({
      where: { email: mixedCaseEmail.toLowerCase() },
    });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(mixedCaseEmail.toLowerCase());
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user?.passwordHash).not.toContain(PASSWORD);
  });

  it("auth:session:{sessionId} существует в Redis с корректным payload", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const res = await request(started.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });

    expect(res.status).toBe(201);

    const tokenPayload = jwt.decode(res.body.accessToken) as {
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
});
