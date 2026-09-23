import { SystemPermission, SystemRole } from "@packages/types";
import request from "supertest";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "./helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const ADMIN_USERS_PATH = "/api/v1/admin/users";
const LOGIN_PATH = "/api/v1/auth/login";
const REGISTER_PATH = "/api/v1/auth/register";

describe("E2E: Admin Users Management API (/api/v1/admin/users)", () => {
  let started: StartedApp;
  const usedEmails: string[] = [];

  let adminToken: string;
  let adminUserId: string;
  let userToken: string;
  let regularUserId: string;

  beforeAll(async () => {
    started = await startTestApp();

    // Гарантируем наличие ролей ADMIN и USER
    const adminRole = await started.prisma.role.upsert({
      where: { slug: SystemRole.ADMIN },
      create: {
        id: "00000000-0000-4000-a000-000000000001",
        slug: SystemRole.ADMIN,
        name: "Администратор",
        permissions: SystemPermission.ALL,
        isSystem: true,
      },
      update: {
        permissions: SystemPermission.ALL,
      },
    });

    await started.prisma.role.upsert({
      where: { slug: SystemRole.USER },
      create: {
        id: "00000000-0000-4000-a000-000000000002",
        slug: SystemRole.USER,
        name: "Пользователь",
        permissions: SystemPermission.NONE,
        isSystem: true,
      },
      update: {
        permissions: SystemPermission.NONE,
      },
    });

    // Создаем пользователя и делаем его администратором
    const adminEmail = uniqueEmail();
    usedEmails.push(adminEmail);

    await request(started.app.getHttpServer()).post(REGISTER_PATH).send({
      email: adminEmail,
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
    });

    await started.prisma.user.update({
      where: { email: adminEmail },
      data: { roleId: adminRole.id },
    });

    const loginAdminRes = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email: adminEmail, password: PASSWORD });

    adminToken = loginAdminRes.body.accessToken;

    const meAdminRes = await request(started.app.getHttpServer())
      .get("/api/v1/profile/me")
      .set("Authorization", `Bearer ${adminToken}`);
    adminUserId = meAdminRes.body.id;

    // Создаем обычного пользователя
    const userEmail = uniqueEmail();
    usedEmails.push(userEmail);

    const regUserRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({
        email: userEmail,
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      });

    userToken = regUserRes.body.accessToken;

    const meUserRes = await request(started.app.getHttpServer())
      .get("/api/v1/profile/me")
      .set("Authorization", `Bearer ${userToken}`);
    regularUserId = meUserRes.body.id;
  });

  afterAll(async () => {
    await started.prisma.user.deleteMany({
      where: { email: { in: usedEmails } },
    });
    await stopTestApp(started);
  });

  it("ADM-01: Неавторизованный запрос возвращает 401 Unauthorized", async () => {
    const res = await request(started.app.getHttpServer()).get(
      ADMIN_USERS_PATH,
    );
    expect(res.status).toBe(401);
  });

  it("ADM-02: Обычный пользователь (USER) получает 403 Forbidden", async () => {
    const res = await request(started.app.getHttpServer())
      .get(ADMIN_USERS_PATH)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it("ADM-03: Администратор получает пагинированный список пользователей", async () => {
    const res = await request(started.app.getHttpServer())
      .get(
        `${ADMIN_USERS_PATH}?page=1&limit=10&sortBy=createdAt&sortOrder=desc`,
      )
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("meta");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(10);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);

    // Проверяем что passwordHash не возвращается
    for (const item of res.body.items) {
      expect(item).not.toHaveProperty("password");
      expect(item).not.toHaveProperty("passwordHash");
    }
  });

  it("ADM-04: Администратор создает нового пользователя, пароль не возвращается в ответе", async () => {
    const newUserEmail = uniqueEmail();
    usedEmails.push(newUserEmail);

    const res = await request(started.app.getHttpServer())
      .post(ADMIN_USERS_PATH)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: newUserEmail,
        displayName: "Admin Created User",
        username: `user_${Date.now().toString().slice(-8)}`,
        role: SystemRole.USER,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(newUserEmail);
    expect(res.body.displayName).toBe("Admin Created User");
    expect(res.body.role).toBe(SystemRole.USER);
    expect(res.body.isActive).toBe(true);
    expect(res.body).not.toHaveProperty("password");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("ADM-05: Администратор получает детальную информацию о пользователе со статистикой", async () => {
    const res = await request(started.app.getHttpServer())
      .get(`${ADMIN_USERS_PATH}/${regularUserId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(regularUserId);
    expect(res.body).toHaveProperty("sessionsCount");
    expect(res.body).toHaveProperty("participationsCount");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("ADM-06: Администратор обновляет данные пользователя", async () => {
    const res = await request(started.app.getHttpServer())
      .patch(`${ADMIN_USERS_PATH}/${regularUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        displayName: "Updated by Admin",
      });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Updated by Admin");
  });

  it("ADM-07: Администратор не может деактивировать собственный аккаунт (400 Bad Request)", async () => {
    const res = await request(started.app.getHttpServer())
      .patch(`${ADMIN_USERS_PATH}/${adminUserId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        isActive: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(
      "Cannot deactivate own administrator account",
    );
  });

  it("ADM-08: Администратор деактивирует пользователя -> сессии сброшены, существующий токен недействителен (401), вход блокируется (401 Unauthorized)", async () => {
    const targetEmail = uniqueEmail();
    usedEmails.push(targetEmail);

    // Регистрируем пользователя
    const regRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({
        email: targetEmail,
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      });
    expect(regRes.status).toBe(201);

    const meRes = await request(started.app.getHttpServer())
      .get("/api/v1/profile/me")
      .set("Authorization", `Bearer ${regRes.body.accessToken}`);
    const targetId = meRes.body.id;

    // Деактивируем через админку
    const deactRes = await request(started.app.getHttpServer())
      .patch(`${ADMIN_USERS_PATH}/${targetId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(deactRes.status).toBe(200);
    expect(deactRes.body.isActive).toBe(false);
    expect(deactRes.body.deactivatedAt).not.toBeNull();

    // Запрос с ранее выданным access token к защищённому endpoint -> 401 Unauthorized (сессия отозвана в Redis / generation fence)
    const revokedTokenRes = await request(started.app.getHttpServer())
      .get("/api/v1/profile/me")
      .set("Authorization", `Bearer ${regRes.body.accessToken}`);

    expect(revokedTokenRes.status).toBe(401);

    // Попытка входа деактивированным пользователем -> 401 Unauthorized
    const loginAttempt = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email: targetEmail, password: PASSWORD });

    expect(loginAttempt.status).toBe(401);
    expect(loginAttempt.body.message).toContain("Invalid credentials");

    // Повторно активируем пользователя
    const reactRes = await request(started.app.getHttpServer())
      .patch(`${ADMIN_USERS_PATH}/${targetId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });

    expect(reactRes.status).toBe(200);
    expect(reactRes.body.isActive).toBe(true);
    expect(reactRes.body.deactivatedAt).toBeNull();

    // Теперь вход успешен
    const loginSuccess = await request(started.app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ email: targetEmail, password: PASSWORD });

    expect(loginSuccess.status).toBe(200);
    expect(loginSuccess.body).toHaveProperty("accessToken");
  });
});
