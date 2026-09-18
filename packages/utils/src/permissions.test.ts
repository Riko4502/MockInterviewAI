import { SystemPermission } from "@packages/types";
import { describe, expect, it } from "vitest";
import {
  combinePermissions,
  decodePermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  toBigIntBitmask,
} from "./permissions";

describe("Permissions Utilities (@packages/utils)", () => {
  describe("toBigIntBitmask", () => {
    it("корректно конвертирует различные типы", () => {
      expect(toBigIntBitmask(null)).toBe(SystemPermission.NONE);
      expect(toBigIntBitmask(undefined)).toBe(SystemPermission.NONE);
      expect(toBigIntBitmask("")).toBe(SystemPermission.NONE);
      expect(toBigIntBitmask("invalid")).toBe(SystemPermission.NONE);
      expect(toBigIntBitmask(15)).toBe(15n);
      expect(toBigIntBitmask("31")).toBe(31n);
      expect(toBigIntBitmask(100n)).toBe(100n);
      expect(toBigIntBitmask(-1)).toBe(SystemPermission.NONE);
      expect(toBigIntBitmask("-1")).toBe(SystemPermission.NONE);
      expect(toBigIntBitmask(-100n)).toBe(SystemPermission.NONE);
    });

    it("отрицательные значения маски не дают прав и не распознаются как ADMINISTRATOR", () => {
      expect(hasPermission(-1, SystemPermission.USERS_READ)).toBe(false);
      expect(hasAllPermissions("-1", SystemPermission.USERS_READ)).toBe(false);
      expect(hasAnyPermission(-1n, SystemPermission.USERS_READ)).toBe(false);
    });
  });

  describe("combinePermissions", () => {
    it("объединяет набор битовых прав", () => {
      const combined = combinePermissions(
        SystemPermission.USERS_READ,
        SystemPermission.USERS_MANAGE,
      );
      expect(combined).toBe(6n);
    });
  });

  describe("hasPermission", () => {
    it("проверяет наличие права", () => {
      const userPerms = combinePermissions(
        SystemPermission.USERS_READ,
        SystemPermission.ROLES_MANAGE,
      );

      expect(hasPermission(userPerms, SystemPermission.USERS_READ)).toBe(true);
      expect(hasPermission(userPerms, SystemPermission.ROLES_MANAGE)).toBe(
        true,
      );
      expect(hasPermission(userPerms, SystemPermission.USERS_MANAGE)).toBe(
        false,
      );
    });

    it("ADMINISTRATOR автоматически имеет любое право (Superuser bypass)", () => {
      const adminPerms = SystemPermission.ADMINISTRATOR;
      expect(hasPermission(adminPerms, SystemPermission.USERS_READ)).toBe(true);
      expect(hasPermission(adminPerms, SystemPermission.USERS_MANAGE)).toBe(
        true,
      );
    });
  });

  describe("hasAllPermissions", () => {
    it("возвращает true только если присутствуют все требуемые права", () => {
      const userPerms = combinePermissions(
        SystemPermission.USERS_READ,
        SystemPermission.USERS_MANAGE,
      );

      expect(
        hasAllPermissions(
          userPerms,
          SystemPermission.USERS_READ,
          SystemPermission.USERS_MANAGE,
        ),
      ).toBe(true);

      expect(
        hasAllPermissions(
          userPerms,
          SystemPermission.USERS_READ,
          SystemPermission.ROLES_MANAGE,
        ),
      ).toBe(false);
    });

    it("ADMINISTRATOR всегда проходит проверку hasAllPermissions", () => {
      expect(
        hasAllPermissions(
          SystemPermission.ADMINISTRATOR,
          SystemPermission.USERS_READ,
          SystemPermission.ROLES_MANAGE,
        ),
      ).toBe(true);
    });
  });

  describe("hasAnyPermission", () => {
    it("возвращает true если есть хотя бы одно из прав", () => {
      const userPerms = SystemPermission.USERS_READ;

      expect(
        hasAnyPermission(
          userPerms,
          SystemPermission.USERS_READ,
          SystemPermission.USERS_MANAGE,
        ),
      ).toBe(true);

      expect(
        hasAnyPermission(
          userPerms,
          SystemPermission.USERS_MANAGE,
          SystemPermission.ROLES_MANAGE,
        ),
      ).toBe(false);
    });
  });

  describe("decodePermissions", () => {
    it("расшифровывает битовую маску в массив slug", () => {
      const mask = combinePermissions(
        SystemPermission.ADMINISTRATOR,
        SystemPermission.USERS_READ,
      );

      const slugs = decodePermissions(mask);
      expect(slugs).toEqual(["administrator", "users:read"]);
    });

    it("возвращает пустой массив для 0n", () => {
      expect(decodePermissions(SystemPermission.NONE)).toEqual([]);
    });

    it("расшифровывает все права для ALL", () => {
      const allSlugs = decodePermissions(SystemPermission.ALL);
      expect(allSlugs).toContain("administrator");
      expect(allSlugs).toContain("users:read");
      expect(allSlugs).toContain("users:manage");
      expect(allSlugs).toContain("roles:manage");
      expect(allSlugs).toContain("sessions:manage");
      expect(allSlugs).toContain("analytics:read");
    });
  });
});
