import { SetMetadata } from "@nestjs/common";

/** Метаданные ролей (§19, §38 SPEC.md / RBAC) */
export const ROLES_KEY = "roles";

/**
 * Декоратор для указания разрешённых ролей на уровне контроллера или хендлера.
 *
 * @param roles - Список разрешённых ролей (например SystemRole.ADMIN, SystemRole.USER или кастомные).
 * @example
 * ```typescript
 * @Roles(SystemRole.ADMIN)
 * @Get('admin-only')
 * getAdminData() { ... }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
