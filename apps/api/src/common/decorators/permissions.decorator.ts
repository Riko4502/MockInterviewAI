import { SetMetadata } from "@nestjs/common";
import type { PermissionBitmask } from "@packages/types";

/** Метаданные прав доступа (Permissions / PBAC) */
export const PERMISSIONS_KEY = "permissions";

/**
 * Декоратор для указания обязательных прав доступа (Permissions) для выполнения метода.
 *
 * @param permissions - Список требуемых битовых прав (например SystemPermission.USERS_MANAGE).
 * @example
 * ```typescript
 * @RequirePermissions(SystemPermission.USERS_MANAGE)
 * @Delete('users/:id')
 * deleteUser() { ... }
 * ```
 */
export const RequirePermissions = (...permissions: PermissionBitmask[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
