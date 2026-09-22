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
import { PrismaService } from "../../prisma/prisma.service";
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
   * @param prisma - PrismaService для fail-closed проверки пользователя в PostgreSQL (§CWE-613).
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly authSessionService: AuthSessionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Проверяет access token или пропускает для `@Public()` endpoints.
   *
   * @param context - Контекст выполнения (ExecutionContext).
   * @returns `true` если запрос разрешён.
   * @throws {UnauthorizedException} Если token отсутствует, невалиден (401)
   *   или auth-сессия отозвана/истекла (401).
   * @throws {Error} Если Redis или БД недоступны (Nest → 500).
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

    // Generation claim обязателен для всех access-токенов (§CWE-613).
    if (payload.generation === undefined) {
      throw new UnauthorizedException("Session has expired or been revoked");
    }

    // Live-проверка сессии в Redis: logout/деактивация/ротация инвалидируют
    // access token везде (A8). Проверяется также совпадение поколения авторизации (§CWE-362, §CWE-613).
    const session = await this.authSessionService.getSession(payload.sid);
    if (!session) {
      throw new UnauthorizedException("Session has expired or been revoked");
    }

    if (session.userId !== payload.sub) {
      throw new UnauthorizedException("Session has expired or been revoked");
    }

    if (
      session.generation === undefined ||
      payload.generation !== session.generation
    ) {
      throw new UnauthorizedException("Session has expired or been revoked");
    }

    // Fail-closed проверка пользователя в PostgreSQL (deletedAt / актуальный generation) (§CWE-613).
    // Защищает от сценария, когда Redis был недоступен при деактивации / смене поколения,
    // и сессия в Redis еще не была отозвана до выполнения фоновой durable-задачи.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        deletedAt: true,
        generation: true,
      },
    });

    if (
      !user ||
      user.deletedAt !== null ||
      user.generation !== payload.generation
    ) {
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
