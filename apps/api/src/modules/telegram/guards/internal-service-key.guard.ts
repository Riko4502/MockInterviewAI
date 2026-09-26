import { createHash, timingSafeEqual } from "node:crypto";
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/**
 * Guard аутентификации внутренних вызовов сервиса-бота
 * (`X-Internal-Service-Key`).
 *
 * Сравнение ключа выполняется constant-time через `timingSafeEqual`,
 * защита от timing-атак (§8 TELEGRAM_BOT_ARCHITECTURE.md).
 *
 * Оба значения (ожидаемое и фактическое) перед сравнением хешируются через
 * SHA-256: длина заголовка контролируется атакующим, а `timingSafeEqual`
 * бросает `RangeError` при разной длине входных Buffer.
 *
 * Ключ не логируется и не попадает в описание ошибки (SPEC §13).
 */
@Injectable()
export class InternalServiceKeyGuard implements CanActivate {
  private readonly expectedHash: Buffer;

  constructor(configService: ConfigService) {
    const secret = configService.get<string>("telegram.internalServiceKey");
    if (!secret) {
      throw new Error("INTERNAL_SERVICE_KEY is not configured");
    }
    this.expectedHash = createHash("sha256").update(secret).digest();
  }

  /**
   * Проверяет заголовок `X-Internal-Service-Key`.
   *
   * @param context - Контекст выполнения NestJS.
   * @returns `true`, если ключ совпадает.
   * @throws {UnauthorizedException} Если заголовок отсутствует или ключ не совпадает.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header("x-internal-service-key");

    if (!provided) {
      throw new UnauthorizedException("Invalid internal service key");
    }

    const actualHash = createHash("sha256").update(provided).digest();

    if (!timingSafeEqual(actualHash, this.expectedHash)) {
      throw new UnauthorizedException("Invalid internal service key");
    }

    return true;
  }
}
