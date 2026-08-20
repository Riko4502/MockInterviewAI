import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: value import required for NestJS DI metadata
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/**
 * Глобальный guard проверки `Origin`/`Referer` заголовков (CSF, §29 SPEC.md).
 *
 * Сравнивает значение `Origin` или `Referer` с списком `ALLOWED_ORIGINS`.
 * Если ни один заголовок не присутствует — запрос пропускается (не все клиенты
 * отправляют заголовки). Если заголовок есть, но не совпадает с разрешёнными
 *起源ами — бросает `ForbiddenException` (403).
 *
 * Регистрируется глобально через `APP_GUARD` провайдер.
 * Защищает state-changing endpoints: `/auth/refresh`, `/logout`,
 * `/logout-all`, `/change-password` (§29 SPEC.md).
 */
@Injectable()
export class OriginCheckGuard implements CanActivate {
  /**
   * @param configService - Конфигурация приложения (секция `allowedOrigins`).
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * Проверяет Origin/Referer заголовки на соответствие ALLOWED_ORIGINS.
   *
   * @param context - Контекст выполнения (ExecutionContext).
   * @returns `true` если запрос разрешён.
   * @throws {ForbiddenException} Если Origin/Referer не в списке разрешённых (403).
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const allowedOrigins =
      this.configService.get<string[]>("allowedOrigins") ?? [];

    const origin = request.headers.origin;
    const referer = request.headers.referer;

    const value = origin ?? referer;

    if (!value) {
      return true;
    }

    const isAllowed = allowedOrigins.some((allowed) =>
      value.startsWith(allowed),
    );

    if (!isAllowed) {
      throw new ForbiddenException("Origin not allowed");
    }

    return true;
  }
}
