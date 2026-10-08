import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { NotificationOutboxStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationDispatcher } from "./notification-dispatcher.service";

/**
 * Релей outbox (ADR-003:70).
 *
 * `ScheduleModule.forRoot()` уже подключён в `AppModule`, поэтому отдельного
 * расписания не требуется. Релей — единственное место, откуда событие
 * попадает в каналы: доменный код только пишет строки.
 */
@Injectable()
export class NotificationOutboxRelay {
  private readonly logger = new Logger(NotificationOutboxRelay.name);

  /** Сколько строк забирает один проход. */
  private readonly batchSize = 50;

  /** После стольких неудач строка признаётся зависшей. */
  private readonly maxAttempts = 5;

  /** Откат: минута, две, четыре... */
  private readonly baseBackoffMs = 60_000;

  @Cron("* * * * * *")
  async relay(): Promise<void> {
    // В тестах релей не крутится. Сьюты делят одну БД, и фоновая доставка
    // конкурировала бы за одни и те же строки outbox с другими Nest-инстансами,
    // оставляя в выводе ошибки вида «Connection is closed» после закрытия
    // приложения. Проверяется сам `relay()` — вызовом напрямую.
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const due = await this.prisma.notificationOutbox.findMany({
      where: {
        status: NotificationOutboxStatus.PENDING,
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: this.batchSize,
    });

    for (const row of due) {
      await this.process(row.id, row.attempts);
    }
  }

  /**
   * Забирает строку себе сравнением `attempts` и доставляет её.
   *
   * Сравнение и обновление — это compare-and-swap в одном UPDATE, поэтому два
   * прохода релея не доставят одну строку дважды, даже если экземпляров
   * больше одного. Инкремента здесь же означает, что падение посреди доставки
   * тоже считается попыткой, что и нужно для at-least-once.
   */
  private async process(id: string, expectedAttempts: number): Promise<void> {
    const claimed = await this.prisma.notificationOutbox.updateMany({
      where: {
        id,
        status: NotificationOutboxStatus.PENDING,
        attempts: expectedAttempts,
      },
      data: { attempts: { increment: 1 } },
    });

    if (claimed.count === 0) {
      return;
    }

    const row = await this.prisma.notificationOutbox.findUniqueOrThrow({
      where: { id },
    });

    try {
      await this.dispatcher.deliver(row);

      await this.prisma.notificationOutbox.update({
        where: { id },
        data: {
          status: NotificationOutboxStatus.DELIVERED,
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = row.attempts + 1 >= this.maxAttempts;

      // Зависшая строка не удаляется и не залипает в PENDING: FAILED делает
      // её видимой для наблюдаемости (ADR-003:70), иначе очередь молча росла бы.
      await this.prisma.notificationOutbox.update({
        where: { id },
        data: {
          status: exhausted
            ? NotificationOutboxStatus.FAILED
            : NotificationOutboxStatus.PENDING,
          nextAttemptAt: new Date(Date.now() + this.backoffMs(row.attempts)),
          lastError: message.slice(0, 1000),
        },
      });

      this.logger.warn(
        `Outbox ${id} attempt ${row.attempts + 1} failed${exhausted ? " and is now FAILED" : ""}: ${message}`,
      );
    }
  }

  private backoffMs(attempts: number): number {
    return this.baseBackoffMs * 2 ** attempts;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}
}
