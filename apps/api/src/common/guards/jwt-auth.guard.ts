import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthSessionService } from "../../modules/auth/services/auth-session.service";
import { TokenService } from "../../modules/auth/services/token.service";

/**
 * Гард JWT-аутентификации.
 *
 * Извлекает JWT access token исключительно из заголовка `Authorization: Bearer <token>`,
 * верифицирует подпись, срок действия и проверяет активность сессии в Redis.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Authentication token required");
    }

    const payload = this.tokenService.verifyAccessToken(token);

    // Проверяем, что сессия активна в Redis и не отозвана при logout/инвалидации
    const session = await this.authSessionService.getSession(payload.sid);
    if (!session) {
      throw new UnauthorizedException("Session has expired or been revoked");
    }

    // Сохраняем payload в объекте запроса для декоратора @CurrentUser
    (request as Request & { user: typeof payload }).user = payload;

    return true;
  }

  /**
   * Извлекает access token исключительно из заголовка Authorization (Bearer <token>).
   */
  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    }

    return null;
  }
}
