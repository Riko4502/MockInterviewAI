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
const SESSIONS_PATH = "/api/v1/sessions";
const MEDIA_TOKEN_PATH = "/api/v1/realtime/media-token";

describe("E2E: POST /api/v1/realtime/media-token", () => {
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

  async function createSession(accessToken: string): Promise<string> {
    const res = await request(started.app.getHttpServer())
      .post(SESSIONS_PATH)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(201);
    return res.body.sessionId as string;
  }

  it("выдаёт LiveKit токен для активной сессии с ролью INTERVIEWER", async () => {
    const accessToken = await registerAndLogin();
    const sessionId = await createSession(accessToken);

    const res = await request(started.app.getHttpServer())
      .post(MEDIA_TOKEN_PATH)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ sessionId });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual([
      "roomName",
      "serverUrl",
      "token",
    ]);
    expect(res.body.roomName).toBe(sessionId);

    const payload = jwt.decode(res.body.token) as jwt.JwtPayload;
    expect(payload.video.room).toBe(sessionId);
    expect(payload.video.canPublish).toBe(true);
    expect(payload.video.canPublishSources).toEqual([
      "camera",
      "microphone",
      "screen_share",
    ]);
    expect(payload.video.canPublishData).toBe(false);
    expect(payload.video.roomAdmin).toBe(false);
    expect(payload.video.roomRecord).toBe(false);
  });

  it("отклоняет не-UUID sessionId → 400", async () => {
    const accessToken = await registerAndLogin();

    const res = await request(started.app.getHttpServer())
      .post(MEDIA_TOKEN_PATH)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ sessionId: "not-a-uuid" });

    expect(res.status).toBe(400);
  });

  it("отклоняет запрос без access-токена → 401", async () => {
    const res = await request(started.app.getHttpServer())
      .post(MEDIA_TOKEN_PATH)
      .send({ sessionId: randomUUID() });

    expect(res.status).toBe(401);
  });

  it("отклоняет запрос для несуществующей сессии → 403", async () => {
    const accessToken = await registerAndLogin();

    const res = await request(started.app.getHttpServer())
      .post(MEDIA_TOKEN_PATH)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ sessionId: randomUUID() });

    expect(res.status).toBe(403);
  });
});
