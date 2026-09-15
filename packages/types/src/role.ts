/**
 * Системные роли платформы по умолчанию.
 */
export const SystemRole = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

/**
 * Тип роли пользователя.
 */
export type UserRole = string;

/**
 * Системные битовые флаги прав доступа (BigInt Bitmask).
 * Позволяет выполнять атомарные O(1) проверки прав в одной процессорной инструкции
 * и хранить набор прав в компактном числовом виде (PostgreSQL BIGINT / 64-bit int).
 */
export const SystemPermission = {
  NONE: 0n,
  /**
   * Суперпользователь: автоматически проходит любые проверки разрешений (Superuser bypass).
   */
  ADMINISTRATOR: 1n << 0n, // 1n (0b0000001)
  USERS_READ: 1n << 1n, // 2n (0b0000010) - Просмотр пользователей
  USERS_MANAGE: 1n << 2n, // 4n (0b0000100) - Управление пользователями
  ROLES_MANAGE: 1n << 3n, // 8n (0b0001000) - Управление ролями и правами
  SESSIONS_MANAGE: 1n << 4n, // 16n (0b0010000) - Управление сессиями интервью
  ANALYTICS_READ: 1n << 5n, // 32n (0b0100000) - Просмотр аналитики и метрик

  /**
   * Пресет: все базовые права платформы.
   */
  ALL: (1n << 6n) - 1n, // 63n
} as const;

export type SystemPermission =
  (typeof SystemPermission)[keyof typeof SystemPermission];

/**
 * Словарь строковых идентификаторов (slug) для отображения в UI и расшифровки.
 */
export const PermissionSlugs = {
  [SystemPermission.ADMINISTRATOR.toString()]: "administrator",
  [SystemPermission.USERS_READ.toString()]: "users:read",
  [SystemPermission.USERS_MANAGE.toString()]: "users:manage",
  [SystemPermission.ROLES_MANAGE.toString()]: "roles:manage",
  [SystemPermission.SESSIONS_MANAGE.toString()]: "sessions:manage",
  [SystemPermission.ANALYTICS_READ.toString()]: "analytics:read",
} as const;

export type PermissionSlug =
  (typeof PermissionSlugs)[keyof typeof PermissionSlugs];

export type PermissionBitmask = bigint | string | number;

/**
 * DTO роли.
 */
export interface RoleDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: string; // BigInt сериализованный в строку
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * DTO права доступа (Permission) для справочника в UI.
 */
export interface PermissionDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  bitValue: string; // BigInt сериализованный в строку
  createdAt: Date | string;
}
