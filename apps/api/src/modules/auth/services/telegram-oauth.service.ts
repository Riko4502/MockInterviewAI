import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TelegramAuthDto } from "@packages/dto";
import { RedisService } from "../../../redis/redis.service";

/** TTL для replay guard в Redis (5 минут) */
const REPLAY_GUARD_TTL_SECONDS = 300;
/** Максимальный возраст auth_date от Telegram (300 секунд) */
const MAX_AUTH_DATE_AGE_SECONDS = 300;
/** Префикс ключа replay guard в Redis */
export const REDIS_TELEGRAM_REPLAY_PREFIX = "auth:telegram:replay:";

@Injectable()
export class TelegramOAuthService {
  private readonly logger = new Logger(TelegramOAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Проверяет подлинность, актуальность и однократность использования payload Telegram.
   *
   * @param dto - Валидированный DTO от Telegram Login Widget.
   * @param rawPayload - Сырой неочищенный запрос (Request Body) для HMAC проверки всех подписываемых полей.
   * @throws {UnauthorizedException} Если подпись недействительна, данные устарели или токен уже использован.
   */
  async validateTelegramPayload(
    dto: TelegramAuthDto,
    rawPayload?: Record<string, unknown>,
  ): Promise<void> {
    const botToken = this.configService.get<string>("telegram.botToken");
    if (!botToken || botToken.trim() === "") {
      this.logger.error("TELEGRAM_BOT_TOKEN is not configured");
      throw new UnauthorizedException("Telegram authentication is unavailable");
    }

    const sourceObj = (
      rawPayload && Object.keys(rawPayload).length > 0 ? rawPayload : dto
    ) as Record<string, unknown>;

    const rawHash = (sourceObj.hash ?? dto.hash) as string;
    const rawAuthDate = sourceObj.auth_date ?? dto.auth_date;

    // 1. Проверка актуальности auth_date
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const authDate =
      typeof rawAuthDate === "number"
        ? rawAuthDate
        : Number.parseInt(String(rawAuthDate), 10);

    if (
      Number.isNaN(authDate) ||
      nowInSeconds - authDate > MAX_AUTH_DATE_AGE_SECONDS ||
      authDate > nowInSeconds + 60
    ) {
      throw new UnauthorizedException(
        "Telegram authentication payload has expired",
      );
    }

    // 2. Формирование data_check_string
    const dataCheckArr: string[] = [];

    for (const key of Object.keys(sourceObj).sort()) {
      if (key === "hash") continue;
      const val = sourceObj[key];
      if (val !== undefined && val !== null) {
        dataCheckArr.push(`${key}=${val}`);
      }
    }
    const dataCheckString = dataCheckArr.join("\n");

    // 3. Вычисление secret_key = SHA256(botToken) и HMAC-SHA256
    const secretKey = createHash("sha256").update(botToken).digest();
    const computedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // 4. Безопасное сравнение за постоянное время timingSafeEqual
    const hashBuffer = Buffer.from(rawHash || "", "utf-8");
    const computedBuffer = Buffer.from(computedHash, "utf-8");

    if (
      hashBuffer.length !== computedBuffer.length ||
      !timingSafeEqual(hashBuffer, computedBuffer)
    ) {
      throw new UnauthorizedException(
        "Invalid Telegram authentication signature",
      );
    }

    // 5. Redis replay protection (auth:telegram:replay:{hash})
    const remainingValiditySeconds = Math.max(
      1,
      authDate + MAX_AUTH_DATE_AGE_SECONDS - nowInSeconds + 1,
    );
    const replayTtlSeconds = Math.max(
      REPLAY_GUARD_TTL_SECONDS,
      remainingValiditySeconds,
    );

    const replayKey = `${REDIS_TELEGRAM_REPLAY_PREFIX}${rawHash}`;
    const setSuccess = await this.redisService.setNx(
      replayKey,
      "1",
      replayTtlSeconds,
    );

    if (!setSuccess) {
      throw new UnauthorizedException(
        "Telegram auth payload has already been used",
      );
    }
  }
}
