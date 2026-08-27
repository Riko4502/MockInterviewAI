import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Кастомный throttler guard для auth endpoints (§41 SPEC.md).
 *
 * Использует `ip + body.email` как tracker — защита от массовой регистрации
 * одного email с разных IP и одного IP с разными email.
 *
 * Применяется per-route: `@UseGuards(AuthThrottlerGuard)`.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  /**
   * Возвращает tracker ключ для rate limiting (§41 SPEC.md).
   *
   * Формат: `{ip}:{email}` — комбинация IP и email из request body.
   * Если email отсутствует — используется только IP.
   *
   * Переопределяет `ThrottlerGuard.getTracker`; в `@nestjs/throttler` v6
   * первым аргументом передаётся request (см. `handleRequest`).
   *
   * @param request - Express request текущего HTTP-вызова.
   * @returns Tracker строка для кэша rate limiter.
   */
  async getTracker(request: Record<string, unknown>): Promise<string> {
    const ip =
      (request.ip as string | undefined) ??
      ((request.socket as { remoteAddress?: string } | undefined)
        ?.remoteAddress as string | undefined) ??
      "unknown";
    const email = (request.body as { email?: string } | undefined)?.email;

    return email ? `${ip}:${email}` : ip;
  }
}
