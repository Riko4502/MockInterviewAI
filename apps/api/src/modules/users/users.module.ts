import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SecurityEventsModule } from "../security-events/security-events.module";
import { StorageModule } from "../storage/storage.module";
import { ProfileController } from "./profile.controller";
import { UserCleanupCron } from "./services/user-cleanup.cron";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

/**
 * Сервис работы с пользователями и профилями.
 *
 * `NotificationsModule` подключается ради `NotificationDispatcher`: создание
 * пользователя публикует `system.welcome` в outbox в той же транзакции
 * (ADR-003:65-68). Обратной зависимости нет — модуль уведомлений работает
 * только через `PrismaService`, поэтому цикла не возникает.
 *
 * `SecurityEventsModule` даёт доступ к `SecurityEventsService` (аудит отвязок)
 * и транзитивно — к `RabbitMqPublisher` для отправки кода отвязки боту (D6).
 */
@Module({
  imports: [
    forwardRef(() => AuthModule),
    StorageModule,
    NotificationsModule,
    SecurityEventsModule,
  ],
  controllers: [ProfileController, UsersController],
  providers: [UsersService, UserCleanupCron],
  exports: [UsersService],
})
export class UsersModule {}
