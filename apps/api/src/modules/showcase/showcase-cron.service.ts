import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ShowcaseCardStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { SHOWCASE_LIMITS } from "./showcase.constants";

/** Redis-ключ распределенного лока для защиты от одновременного запуска на нескольких репликах */
export const SHOWCASE_EXPIRY_LOCK_KEY = "lock:cron:showcase-expiry";

/** Время жизни распределенного лока в секундах (15 минут) */
export const SHOWCASE_EXPIRY_LOCK_TTL_SECONDS = 900;

/** Результат выполнения крон-задачи */
export interface ShowcaseCronResult {
  renewed: number;
  expired: number;
}

/**
 * Фоновый крон-сервис витрины анкет.
 *
 * Запускается каждые 15 минут, берет распределенный Redis-лок и обрабатывает активные анкеты
 * с истекшим сроком жизни (expiresAt <= now()):
 * 1. Если autoRenew = true — продлевает срок публикации на 15 дней и поднимает карточку в топ (bumpedAt = now).
 * 2. Если autoRenew = false — переводит статус карточки в EXPIRED.
 */
@Injectable()
export class ShowcaseCronService {
  private readonly logger = new Logger(ShowcaseCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Точка входа фоновой задачи. Запускается каждые 15 минут.
   */
  @Cron("*/15 * * * *")
  async handleCron(): Promise<ShowcaseCronResult> {
    // 1. Захват Distributed Lock в Redis
    const lockAcquired = await this.redisService.setNx(
      SHOWCASE_EXPIRY_LOCK_KEY,
      new Date().toISOString(),
      SHOWCASE_EXPIRY_LOCK_TTL_SECONDS,
    );

    if (!lockAcquired) {
      this.logger.debug(
        "Showcase expiry cron job is already running on another instance, skipping...",
      );
      return { renewed: 0, expired: 0 };
    }

    this.logger.log(
      "Starting showcase card expiration and auto-renewal check...",
    );

    try {
      // 2. Обработка просроченных карточек
      const result = await this.processExpiredCards();
      this.logger.log(
        `Showcase cron completed: ${result.renewed} card(s) auto-renewed, ${result.expired} card(s) marked as expired.`,
      );
      return result;
    } catch (err) {
      this.logger.error(
        `Error during showcase expiry cron execution: ${String(err)}`,
      );
      return { renewed: 0, expired: 0 };
    } finally {
      // 3. Гарантированное освобождение распределенного лока
      await this.redisService.delete(SHOWCASE_EXPIRY_LOCK_KEY);
    }
  }

  /**
   * Атомарная обработка просроченных карточек (expiresAt <= now()).
   *
   * Использует updateMany для эффективного выполнения без N+1 запросов:
   * 1. Карточки с autoRenew = true продлеваются на CARD_LIFETIME_MS (15 дней) и бампаются в топ.
   * 2. Карточки с autoRenew = false переводятся в статус EXPIRED.
   *
   * @returns Количество продленных и истекших карточек.
   */
  async processExpiredCards(): Promise<ShowcaseCronResult> {
    const now = new Date();
    const cardTtlMs = SHOWCASE_LIMITS.CARD_TTL_DAYS * 24 * 60 * 60 * 1000;

    // 1. Продлеваем карточки с включенным autoRenew
    const renewedResult = await this.prisma.showcaseCard.updateMany({
      where: {
        status: ShowcaseCardStatus.ACTIVE,
        expiresAt: { lte: now },
        autoRenew: true,
      },
      data: {
        expiresAt: new Date(now.getTime() + cardTtlMs),
        bumpedAt: now,
      },
    });

    // 2. Деактивируем просроченные карточки без autoRenew
    const expiredResult = await this.prisma.showcaseCard.updateMany({
      where: {
        status: ShowcaseCardStatus.ACTIVE,
        expiresAt: { lte: now },
        autoRenew: false,
      },
      data: {
        status: ShowcaseCardStatus.EXPIRED,
      },
    });

    return {
      renewed: renewedResult.count,
      expired: expiredResult.count,
    };
  }
}
