import {
  type PermissionBitmask,
  type PermissionSlug,
  PermissionSlugs,
  SystemPermission,
} from "@packages/types";

/**
 * Безопасно преобразует значение в bigint битовую маску.
 * Поддерживает bigint, string, number, null и undefined.
 */
export function toBigIntBitmask(
  val: PermissionBitmask | null | undefined,
): bigint {
  if (val === null || val === undefined) return SystemPermission.NONE;
  let parsed: bigint;
  if (typeof val === "bigint") {
    parsed = val;
  } else {
    try {
      parsed = BigInt(val);
    } catch {
      return SystemPermission.NONE;
    }
  }
  return parsed >= 0n ? parsed : SystemPermission.NONE;
}

/**
 * Проверяет наличие конкретного права в битовой маске пользователя.
 * Если у пользователя выставлен бит `ADMINISTRATOR`, проверка всегда возвращает `true`.
 */
export function hasPermission(
  userBitmask: PermissionBitmask | null | undefined,
  requiredPermission: PermissionBitmask,
): boolean {
  const user = toBigIntBitmask(userBitmask);
  const required = toBigIntBitmask(requiredPermission);

  // Superuser bypass: администратор имеет доступ ко всем правам
  if (
    (user & SystemPermission.ADMINISTRATOR) ===
    SystemPermission.ADMINISTRATOR
  ) {
    return true;
  }

  return (user & required) === required;
}

/**
 * Проверяет наличие ВСЕХ указанных прав (логическое AND).
 * Если у пользователя выставлен бит `ADMINISTRATOR`, возвращает `true`.
 */
export function hasAllPermissions(
  userBitmask: PermissionBitmask | null | undefined,
  ...requiredPermissions: PermissionBitmask[]
): boolean {
  const user = toBigIntBitmask(userBitmask);

  if (
    (user & SystemPermission.ADMINISTRATOR) ===
    SystemPermission.ADMINISTRATOR
  ) {
    return true;
  }

  const combinedRequired = combinePermissions(...requiredPermissions);
  return (user & combinedRequired) === combinedRequired;
}

/**
 * Проверяет наличие ХОТЯ БЫ ОДНОГО из указанных прав (логическое OR).
 * Если у пользователя выставлен бит `ADMINISTRATOR`, возвращает `true`.
 */
export function hasAnyPermission(
  userBitmask: PermissionBitmask | null | undefined,
  ...requiredPermissions: PermissionBitmask[]
): boolean {
  const user = toBigIntBitmask(userBitmask);

  if (
    (user & SystemPermission.ADMINISTRATOR) ===
    SystemPermission.ADMINISTRATOR
  ) {
    return true;
  }

  const combinedRequired = combinePermissions(...requiredPermissions);
  return (user & combinedRequired) !== SystemPermission.NONE;
}

/**
 * Объединяет набор битовых прав в единую маску.
 */
export function combinePermissions(
  ...permissions: PermissionBitmask[]
): bigint {
  return permissions.reduce<bigint>(
    (acc, cur) => acc | toBigIntBitmask(cur),
    SystemPermission.NONE,
  );
}

/**
 * Расшифровывает битовую маску пользователя в человекочитаемый массив строковых разрешений (slug).
 * Удобно для UI, профиля, таблиц администратора и логирования.
 *
 * @example
 * decodePermissions("3") // ["administrator", "users:read"]
 */
export function decodePermissions(
  userBitmask: PermissionBitmask | null | undefined,
): PermissionSlug[] {
  const user = toBigIntBitmask(userBitmask);
  const result: PermissionSlug[] = [];

  for (const [bitStr, slug] of Object.entries(PermissionSlugs)) {
    const bit = BigInt(bitStr);
    if ((user & bit) === bit) {
      result.push(slug);
    }
  }

  return result;
}
