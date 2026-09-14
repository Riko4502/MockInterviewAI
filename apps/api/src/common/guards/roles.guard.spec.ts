import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SystemPermission, SystemRole } from "@packages/types";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(
    user?: { permissions?: number | string | bigint },
    handler: (...args: unknown[]) => unknown = () => {},
    controllerClass: new (...args: unknown[]) => unknown = class {},
  ): ExecutionContext {
    const request = { user };
    return {
      getHandler: () => handler,
      getClass: () => controllerClass,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  describe("Public endpoints", () => {
    it("пропускает запрос, если эндпоинт помечен @Public()", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
        if (key === "isPublic") return true;
        return undefined;
      });

      const context = createMockContext();
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe("Endpoints without role/permission requirements", () => {
    it("разрешает доступ любому пользователю, если @Roles и @RequirePermissions не заданы", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);

      const context = createMockContext({ permissions: 0 });
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe("Missing user", () => {
    it("выбрасывает ForbiddenException (403), если user отсутствует в request", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
        if (key === "roles") return [SystemRole.ADMIN];
        return undefined;
      });

      const context = createMockContext(undefined);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        "Access denied: User is not authenticated",
      );
    });
  });

  describe("ADMIN superuser bypass", () => {
    it("разрешает доступ администратору (бит ADMINISTRATOR) к любым эндпоинтам", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
        if (key === "permissions")
          return [
            SystemPermission.SESSIONS_MANAGE,
            SystemPermission.USERS_MANAGE,
          ];
        return undefined;
      });

      const context = createMockContext({
        permissions: SystemPermission.ADMINISTRATOR.toString(),
      });
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe("@Roles verification (обратная совместимость)", () => {
    it("разрешает доступ ADMIN к эндпоинтам с @Roles(SystemRole.ADMIN)", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
        if (key === "roles") return [SystemRole.ADMIN];
        return undefined;
      });

      const context = createMockContext({
        permissions: SystemPermission.ADMINISTRATOR.toString(),
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("выбрасывает ForbiddenException (403), если у пользователя нет прав администратора", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
        if (key === "roles") return [SystemRole.ADMIN];
        return undefined;
      });

      const context = createMockContext({ permissions: 0 });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        "Access denied: Insufficient permissions",
      );
    });

    it("выбрасывает ForbiddenException (403) для не-ADMIN ролей (например SystemRole.USER), если пользователь не ADMIN", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
        if (key === "roles") return [SystemRole.USER];
        return undefined;
      });

      const context = createMockContext({ permissions: 0 });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        "Access denied: Insufficient permissions",
      );
    });
  });

  describe("@RequirePermissions verification", () => {
    it("разрешает доступ, если у пользователя присутствуют все требуемые битовые права", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
        if (key === "permissions")
          return [
            SystemPermission.USERS_READ,
            SystemPermission.SESSIONS_MANAGE,
          ];
        return undefined;
      });

      // 2n | 16n = 18n
      const userPermissions =
        SystemPermission.USERS_READ | SystemPermission.SESSIONS_MANAGE;
      const context = createMockContext({
        permissions: Number(userPermissions),
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it("выбрасывает ForbiddenException (403), если у пользователя отсутствует хотя бы одно право", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
        if (key === "permissions")
          return [SystemPermission.USERS_READ, SystemPermission.USERS_MANAGE];
        return undefined;
      });

      const context = createMockContext({
        permissions: Number(SystemPermission.USERS_READ),
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        "Access denied: Insufficient permissions",
      );
    });
  });
});
