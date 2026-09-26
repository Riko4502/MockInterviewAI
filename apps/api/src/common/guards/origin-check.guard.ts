import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { OAUTH_NAVIGATION_KEY } from "../decorators/oauth-navigation.decorator";

/**
 * Глобальный guard проверки `Origin`/`Referer` заголовков (CSF, §29 SPEC.md).
 *
 * Сравнивает значение `Origin` или `Referer` с списком `ALLOWED_ORIGINS`.
 * Если ни один заголовок не присутствует — запрос пропускается (не все клиенты
 * отправляют заголовки). Собственный origin API (`http://localhost:{port}`)
 * пропускается всегда — Swagger UI (§61 SPEC.md). Если заголовок есть, но не
 * совпадает (точное равенство, A9) с разрешёнными origins — бросается
 * `ForbiddenException` (403).
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
    if (
      request.method === "GET" &&
      Reflect.getMetadata(OAUTH_NAVIGATION_KEY, context.getHandler()) === true
    ) {
      return true;
    }
    const allowedOrigins =
      this.configService.get<string[]>("allowedOrigins") ?? [];

    const origin = request.headers.origin;
    const referer = request.headers.referer;

    let value = origin;
    if (!value && referer) {
      try {
        value = new URL(referer).origin;
      } catch {
        value = referer;
      }
    }

    if (!value) {
      return true;
    }

    // Собственный origin API (Swagger UI на `/docs`, §61 SPEC.md):
    // страница docs отправляет запросы к `/docs-json` со своим Origin.
    const selfOrigin = `http://localhost:${
      this.configService.get<number>("port") ?? 3001
    }`;
    if (value === selfOrigin) {
      return true;
    }

    const isAllowed = allowedOrigins.some(
      (allowed) => value === allowed.replace(/\/+$/, ""),
    );

    if (!isAllowed) {
      throw new ForbiddenException("Origin not allowed");
    }

    return true;
  }
}
