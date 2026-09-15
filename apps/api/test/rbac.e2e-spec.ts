import { Controller, Get } from "@nestjs/common";
import { SystemPermission, SystemRole } from "@packages/types";
import jwt from "jsonwebtoken";
import request from "supertest";
import { RequirePermissions } from "../src/common/decorators/permissions.decorator";
import { Public } from "../src/common/decorators/public.decorator";
import { Roles } from "../src/common/decorators/roles.decorator";
import {
  type StartedApp,
  startTestApp,
  stopTestApp,
  uniqueEmail,
} from "./helpers/test-app.helper";

const PASSWORD = "Str0ngPassw0rd!123";
const REGISTER_PATH = "/api/v1/auth/register";
const PROFILE_PATH = "/api/v1/profile/me";

@Controller("test-rbac")
class TestRbacController {
  @Get("public")
  @Public()
  publicEndpoint() {
    return { status: "public-ok" };
  }

  @Get("authenticated")
  authenticatedEndpoint() {
    return { status: "authenticated-ok" };
  }

  @Get("admin-only")
  @Roles(SystemRole.ADMIN)
  adminOnlyEndpoint() {
    return { status: "admin-ok" };
  }

  @Get("permissions-required")
  @RequirePermissions(SystemPermission.ROLES_MANAGE)
  permissionsEndpoint() {
    return { status: "permissions-ok" };
  }
}

describe("E2E: RBAC & Dynamic Bitmask Permissions Flow", () => {
  let started: StartedApp;
  const usedEmails: string[] = [];

  beforeAll(async () => {
    started = await startTestApp([TestRbacController]);

    // Гарантируем наличие системных ролей с битовыми масками
    await started.prisma.role.upsert({
      where: { slug: SystemRole.ADMIN },
      create: {
        id: "00000000-0000-4000-a000-000000000001",
        slug: SystemRole.ADMIN,
        name: "Администратор",
        permissions: SystemPermission.ADMINISTRATOR,
        isSystem: true,
      },
      update: {
        permissions: SystemPermission.ADMINISTRATOR,
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
  });

  afterAll(async () => {
    await started.prisma.user.deleteMany({
      where: { email: { in: usedEmails } },
    });
    await stopTestApp(started);
  });

  it("RBAC-01: Новый зарегистрированный пользователь получает числовую битовую маску permissions: 0 в JWT и роль в профиле", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const regRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });

    expect(regRes.status).toBe(201);
    const token = regRes.body.accessToken;
    const decoded = jwt.decode(token) as {
      sub: string;
      permissions: number | string;
    };

    expect(Number(decoded.permissions)).toBe(0);

    // Проверяем /profile/me
    const profileRes = await request(started.app.getHttpServer())
      .get(PROFILE_PATH)
      .set("Authorization", `Bearer ${token}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.role).toBe(SystemRole.USER);
    expect(profileRes.body.permissions).toBe("0");
  });

  it("RBAC-02: @Public() эндпоинт доступен без авторизации", async () => {
    const res = await request(started.app.getHttpServer()).get(
      "/api/v1/test-rbac/public",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "public-ok" });
  });

  it("RBAC-03: Защищенный эндпоинт без @Roles требует токен (401), но пускает и USER, и ADMIN (200)", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const regRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    const userToken = regRes.body.accessToken;

    // 401 без токена
    const unauthRes = await request(started.app.getHttpServer()).get(
      "/api/v1/test-rbac/authenticated",
    );
    expect(unauthRes.status).toBe(401);

    // 200 с токеном USER
    const authRes = await request(started.app.getHttpServer())
      .get("/api/v1/test-rbac/authenticated")
      .set("Authorization", `Bearer ${userToken}`);
    expect(authRes.status).toBe(200);
    expect(authRes.body).toEqual({ status: "authenticated-ok" });
  });

  it("RBAC-04: Админский эндпоинт @Roles(SystemRole.ADMIN) отклоняет USER (403) и пускает ADMIN (200)", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const regRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    const userToken = regRes.body.accessToken;

    // USER получает 403 Forbidden
    const forbiddenRes = await request(started.app.getHttpServer())
      .get("/api/v1/test-rbac/admin-only")
      .set("Authorization", `Bearer ${userToken}`);
    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.message).toBe(
      "Access denied: Insufficient permissions",
    );

    // Назначаем пользователю роль ADMIN в БД
    const adminRole = await started.prisma.role.findUniqueOrThrow({
      where: { slug: SystemRole.ADMIN },
    });
    await started.prisma.user.update({
      where: { email },
      data: { roleId: adminRole.id },
    });

    // Логинимся заново, чтобы получить JWT с правами ADMIN
    const loginRes = await request(started.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    const adminToken = loginRes.body.accessToken;

    const adminDecoded = jwt.decode(adminToken) as {
      permissions: number | string;
    };
    expect(Number(adminDecoded.permissions)).toBe(1);

    // ADMIN получает 200 OK
    const adminAllowedRes = await request(started.app.getHttpServer())
      .get("/api/v1/test-rbac/admin-only")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminAllowedRes.status).toBe(200);
    expect(adminAllowedRes.body).toEqual({ status: "admin-ok" });
  });

  it("RBAC-05: @RequirePermissions проверяет битовые права и поддерживает ADMINISTRATOR bypass", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const regRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    const userToken = regRes.body.accessToken;

    // Обычный USER без permissions получает 403
    const forbiddenRes = await request(started.app.getHttpServer())
      .get("/api/v1/test-rbac/permissions-required")
      .set("Authorization", `Bearer ${userToken}`);
    expect(forbiddenRes.status).toBe(403);

    // ADMIN (бит ADMINISTRATOR = 1) получает 200 благодаря Superuser bypass
    const adminRole = await started.prisma.role.findUniqueOrThrow({
      where: { slug: SystemRole.ADMIN },
    });
    await started.prisma.user.update({
      where: { email },
      data: { roleId: adminRole.id },
    });

    const loginRes = await request(started.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD });
    const adminToken = loginRes.body.accessToken;

    const adminAllowedRes = await request(started.app.getHttpServer())
      .get("/api/v1/test-rbac/permissions-required")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminAllowedRes.status).toBe(200);
    expect(adminAllowedRes.body).toEqual({ status: "permissions-ok" });
  });
  it("RBAC-06: Обычная (не-ADMIN) роль с требуемым SystemPermission.ROLES_MANAGE получает доступ (200) к @RequirePermissions", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    const regRes = await request(started.app.getHttpServer())
      .post(REGISTER_PATH)
      .send({ email, password: PASSWORD, passwordConfirmation: PASSWORD });
    const userToken = regRes.body.accessToken;

    // Изначально без прав — 403
    const forbiddenRes = await request(started.app.getHttpServer())
      .get("/api/v1/test-rbac/permissions-required")
      .set("Authorization", `Bearer ${userToken}`);
    expect(forbiddenRes.status).toBe(403);

    // Создаем кастомную роль с SystemPermission.ROLES_MANAGE (не-ADMIN)
    const managerRole = await started.prisma.role.upsert({
      where: { slug: "ROLE_MANAGER" },
      create: {
        slug: "ROLE_MANAGER",
        name: "Менеджер ролей",
        description: "Кастомная роль с правом roles:manage",
        permissions: SystemPermission.ROLES_MANAGE,
        isSystem: false,
      },
      update: {
        permissions: SystemPermission.ROLES_MANAGE,
      },
    });

    await started.prisma.user.update({
      where: { email },
      data: { roleId: managerRole.id },
    });

    // Логинимся заново и проверяем claims JWT
    const loginRes = await request(started.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    const managerToken = loginRes.body.accessToken;

    const managerDecoded = jwt.decode(managerToken) as {
      permissions: number | string;
    };
    expect(Number(managerDecoded.permissions)).toBe(
      Number(SystemPermission.ROLES_MANAGE),
    );

    // Проверяем доступ к эндпоинту с @RequirePermissions(SystemPermission.ROLES_MANAGE) -> 200 OK
    const allowedRes = await request(started.app.getHttpServer())
      .get("/api/v1/test-rbac/permissions-required")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(allowedRes.status).toBe(200);
    expect(allowedRes.body).toEqual({ status: "permissions-ok" });

    // Проверяем что эндпоинт @Roles(SystemRole.ADMIN) отклоняет не-ADMIN роль -> 403
    const adminOnlyRes = await request(started.app.getHttpServer())
      .get("/api/v1/test-rbac/admin-only")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(adminOnlyRes.status).toBe(403);
  });
});
