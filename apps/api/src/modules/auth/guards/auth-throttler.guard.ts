import { type ExecutionContext, Injectable } from "@nestjs/common";
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
   * @param context - ExecutionContext NestJS.
   * @returns Tracker строка для кэша rate limiter.
   */
  async getTracker(context: ExecutionContext): Promise<string> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const email = request.body?.email as string | undefined;

    return email ? `${ip}:${email}` : ip;
  }
}
