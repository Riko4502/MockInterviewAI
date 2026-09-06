import { randomUUID } from "node:crypto";
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
const TICKET_PATH = "/api/v1/realtime/ticket";

describe("E2E: POST /api/v1/realtime/ticket (Phase C)", () => {
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

  async function registerAndLogin(): Promise<string> {
    const email = uniqueEmail();
    usedEmails.push(email);
    await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD })
      .expect(201);
    const login = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  it("выдаёт одноразовый тикет typ=realtime с bound sessionId и sid из access-токена", async () => {
    const accessToken = await registerAndLogin();
    const accessPayload = jwt.decode(accessToken) as jwt.JwtPayload;
    const interviewSessionId = randomUUID();

    const res = await request(started.app.getHttpServer())
      .post(TICKET_PATH)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ sessionId: interviewSessionId });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(["ticket"]);
    expect(typeof res.body.ticket).toBe("string");

    const ticketPayload = jwt.decode(res.body.ticket) as jwt.JwtPayload;
    expect(ticketPayload.typ).toBe("realtime");
    expect(ticketPayload.sub).toBe(accessPayload.sub);
    expect(ticketPayload.sid).toBe(accessPayload.sid);
    expect(ticketPayload.sessionId).toBe(interviewSessionId);
    expect(typeof ticketPayload.jti).toBe("string");
    // TTL тикета — 5 минут (300 сек).
    expect(Number(ticketPayload.exp) - Number(ticketPayload.iat)).toBe(300);
  });

  it("отклоняет не-UUID sessionId → 400", async () => {
    const accessToken = await registerAndLogin();

    const res = await request(started.app.getHttpServer())
      .post(TICKET_PATH)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ sessionId: "not-a-uuid" });

    expect(res.status).toBe(400);
  });

  it("отклоняет запрос без access-токена → 401", async () => {
    const res = await request(started.app.getHttpServer())
      .post(TICKET_PATH)
      .send({ sessionId: randomUUID() });

    expect(res.status).toBe(401);
  });
});
