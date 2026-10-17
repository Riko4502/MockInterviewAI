import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Throttler, привязанный к аутентифицированному пользователю.
 *
 * `ThrottlerGuard` по умолчанию считает запросы по IP. Для авторизованных
 * операций это неверно в обе стороны: пользователи за общим NAT делят лимит,
 * а смена IP обходит ограничение. Здесь tracker — `user:{sub}` из JWT
 * (`AccessTokenGuard` — глобальный и выполняется раньше), с откатом на IP для
 * запросов без контекста пользователя.
 *
 * Применяется per-route: `@UseGuards(UserThrottlerGuard)` +
 * `@Throttle({ default: { limit: 1, ttl: 60_000 } })`.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  async getTracker(request: Record<string, unknown>): Promise<string> {
    const user = request.user as { sub?: string } | undefined;
    if (user?.sub) {
      return `user:${user.sub}`;
    }

    const ip =
      (request.ip as string | undefined) ??
      ((request.socket as { remoteAddress?: string } | undefined)
        ?.remoteAddress as string | undefined) ??
      "unknown";

    return `ip:${ip}`;
  }
}
