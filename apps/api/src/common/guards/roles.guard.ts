import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  type PermissionBitmask,
  SystemPermission,
  SystemRole,
} from "@packages/types";
import { hasAllPermissions, hasPermission } from "@packages/utils";
import type { TokenPayload } from "../../modules/auth/services/token.service";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Глобальный guard проверки прав доступа (PBAC / Bitmask RBAC).
 *
 * Читает метаданные `@RequirePermissions(...)` и `@Roles(...)` с уровня метода
 * и класса.
 *
 * Логика проверки:
 * 1. `@Public()` эндпоинты пропускаются без проверки;
 * 2. Если роли и права не указаны — доступ разрешён любому авторизованному пользователю;
 * 3. Если у пользователя выставлен бит `ADMINISTRATOR` — доступ разрешается моментально (Superuser bypass);
 * 4. Если указаны `@RequirePermissions(...)`, проверяется наличие всех прав через `hasAllPermissions()`;
 * 5. Если указаны `@Roles(...)`, проверяется наличие роли или прав администратора;
 * 6. При нехватке прав выбрасывается `403 Forbidden` (`Access denied: Insufficient permissions`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionBitmask[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // Если нет требований к роли или правам — пропускаем
    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!requiredRoles || requiredRoles.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as TokenPayload | undefined;

    if (!user) {
      throw new ForbiddenException("Access denied: User is not authenticated");
    }

    const userPermissions = user.permissions ?? SystemPermission.NONE;

    // 1. Проверка требуемых разрешений (PBAC)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const allowed = hasAllPermissions(
        userPermissions,
        ...requiredPermissions,
      );
      if (!allowed) {
        throw new ForbiddenException("Access denied: Insufficient permissions");
      }
    }

    // 2. Проверка ролей (для обратной совместимости декоратора @Roles)
    if (requiredRoles && requiredRoles.length > 0) {
      const isAdminRequired = requiredRoles.includes(SystemRole.ADMIN);
      const isUserAdmin = hasPermission(
        userPermissions,
        SystemPermission.ADMINISTRATOR,
      );

      if (isAdminRequired && !isUserAdmin) {
        throw new ForbiddenException("Access denied: Insufficient permissions");
      }
    }

    return true;
  }
}
