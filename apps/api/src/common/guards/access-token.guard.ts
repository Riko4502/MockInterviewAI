import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
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
 * `Authorization: Bearer <token>`. При успехе payload добавляется
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
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Проверяет access token или пропускает для `@Public()` endpoints.
   *
   * @param context - Контекст выполнения (ExecutionContext).
   * @returns `true` если запрос разрешён.
   * @throws {UnauthorizedException} Если token отсутствует или невалиден (401).
   */
  canActivate(context: ExecutionContext): boolean {
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
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(" ");
    return type === "Bearer" && token ? token : undefined;
  }
}
