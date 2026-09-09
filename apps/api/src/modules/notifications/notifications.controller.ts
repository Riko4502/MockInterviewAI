import {
  Controller,
  Get,
  type MessageEvent,
  Param,
  Patch,
  Sse,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Observable } from "rxjs";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";

/**
 * Контроллер уведомлений текущего авторизованного пользователя.
 */
@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Получает список неудаленных уведомлений текущего пользователя.
   *
   * @param userId - UUID пользователя из JWT токена.
   * @returns Список уведомлений, отсортированный от новых к старым.
   */
  @Get()
  getNotifications(@CurrentUser("sub") userId: string) {
    return this.notificationsService.getNotifications(userId);
  }

  /**
   * Получает количество непрочитанных уведомлений текущего пользователя.
   *
   * @param userId - UUID пользователя из JWT токена.
   * @returns Количество непрочитанных и неудаленных уведомлений.
   */
  @Get("unread-count")
  getUnreadCount(@CurrentUser("sub") userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  /**
   * Открывает SSE-соединение для получения обновлений уведомлений
   * в реальном времени.
   *
   * @param userId - UUID пользователя из JWT токена.
   * @returns SSE-поток событий текущего пользователя.
   */
  @Sse("stream")
  stream(@CurrentUser("sub") userId: string): Observable<MessageEvent> {
    return this.notificationsService.getStream(userId);
  }

  /**
   * Помечает уведомление текущего пользователя как прочитанное.
   *
   * @param userId - UUID пользователя из JWT токена.
   * @param id - UUID уведомления.
   * @returns Результат выполнения операции.
   */
  @Patch(":id/read")
  markAsRead(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  /**
   * Выполняет soft-delete уведомления текущего пользователя.
   *
   * Уведомление остается в базе данных, но больше не возвращается
   * пользователю в списке уведомлений.
   *
   * @param userId - UUID пользователя из JWT токена.
   * @param id - UUID уведомления.
   * @returns Результат выполнения операции.
   */
  @Patch(":id/delete")
  markAsDeleted(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.notificationsService.markAsDeleted(userId, id);
  }
}
