import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthSessionService } from "../../modules/auth/services/auth-session.service";
import type { TokenPayload } from "../../modules/auth/services/token.service";
import { TokenService } from "../../modules/auth/services/token.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/** HTTP-запрос с добавленным `user` payload из access token (§64 SPEC.md). */
interface AuthRequest extends Request {
  user: TokenPayload;
}

/**
 * Глобальный guard проверки access token (§64 SPEC.md).
 *
 * Проверяет наличие и валидность JWT access token в заголовке
 * `Authorization: Bearer <token>`, а также живую auth-сессию
 * `auth:session:{sid}` в Redis (§16, A8). При успехе payload добавляется
 * в `request.user`.
 *
 * Эндпоинты с декоратором `@Public()` пропускаются без проверки.
 *
 * Регистрируется глобально через `APP_GUARD` провайдер.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  /**
   * @param reflector - Reflector для чтения метаданных `@Public()`.
   * @param tokenService - Сервис верификации JWT (§38 SPEC.md).
   * @param authSessionService - Сервис auth-сессий (live-проверка `EXISTS`, §16).
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  /**
   * Проверяет access token или пропускает для `@Public()` endpoints.
   *
   * @param context - Контекст выполнения (ExecutionContext).
   * @returns `true` если запрос разрешён.
   * @throws {UnauthorizedException} Если token отсутствует, невалиден (401)
   *   или auth-сессия отозвана/истекла (401).
   * @throws {Error} Если Redis недоступен (Nest → 500).
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    const payload = this.tokenService.verifyAccessToken(token);

    // Live-проверка сессии в Redis: logout/деактивация/ротация инвалидируют
    // access token везде (A8). Redis-ошибка пробрасывается наверх (→ 500).
    if (!(await this.authSessionService.isSessionActive(payload.sid))) {
      throw new UnauthorizedException("Session has expired or been revoked");
    }

    request.user = payload;

    return true;
  }

  /**
   * Извлекает JWT token из заголовка `Authorization: Bearer <token>`.
   *
   * @param request - HTTP-запрос Express.
   * @returns JWT token или `undefined`.
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return undefined;
    }

    return authHeader.slice(7).trim() || undefined;
  }
}
