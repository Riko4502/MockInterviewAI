import { Reflector } from "@nestjs/core";
import { SystemPermission, SystemRole } from "@packages/types";
import { PERMISSIONS_KEY, RequirePermissions } from "./permissions.decorator";
import { ROLES_KEY, Roles } from "./roles.decorator";

describe("RBAC Decorators", () => {
  const reflector = new Reflector();

  describe("@Roles", () => {
    it("устанавливает метаданные ролей на класс и метод", () => {
      @Roles(SystemRole.ADMIN)
      class TestController {
        @Roles(SystemRole.USER, "RECRUITER")
        testMethod() {}
      }

      const classRoles = reflector.get<string[]>(ROLES_KEY, TestController);
      const methodRoles = reflector.get<string[]>(
        ROLES_KEY,
        TestController.prototype.testMethod,
      );

      expect(classRoles).toEqual([SystemRole.ADMIN]);
      expect(methodRoles).toEqual([SystemRole.USER, "RECRUITER"]);
    });
  });

  describe("@RequirePermissions", () => {
    it("устанавливает метаданные permissions на класс и метод", () => {
      @RequirePermissions(SystemPermission.USERS_READ)
      class TestController {
        @RequirePermissions(
          SystemPermission.USERS_MANAGE,
          SystemPermission.ROLES_MANAGE,
        )
        testMethod() {}
      }

      const classPermissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController,
      );
      const methodPermissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );

      expect(classPermissions).toEqual([SystemPermission.USERS_READ]);
      expect(methodPermissions).toEqual([
        SystemPermission.USERS_MANAGE,
        SystemPermission.ROLES_MANAGE,
      ]);
    });
  });
});
