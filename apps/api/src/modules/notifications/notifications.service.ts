import {
  Injectable,
  type MessageEvent,
  NotFoundException,
} from "@nestjs/common";
import { Observable, Subject } from "rxjs";

import { NotificationType } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Сервис управления уведомлениями пользователя.
 *
 * Отвечает за получение и изменение уведомлений в базе данных,
 * создание новых уведомлений и их доставку через SSE.
 */
@Injectable()
export class NotificationsService {
  /**
   * Хранилище активных SSE-потоков пользователей.
   *
   * Ключ — UUID пользователя.
   * Значение — поток событий, предназначенный только для этого пользователя.
   */
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Получает все неудаленные уведомления пользователя.
   *
   * @param userId - UUID пользователя.
   * @returns Список уведомлений, отсортированный от новых к старым.
   */
  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Получает количество непрочитанных уведомлений пользователя.
   *
   * Учитываются только уведомления, которые не прочитаны
   * и не были удалены пользователем.
   *
   * @param userId - UUID пользователя.
   * @returns Количество непрочитанных уведомлений.
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
        deletedAt: null,
      },
    });

    return { count };
  }

  /**
   * Возвращает SSE-поток событий для конкретного пользователя.
   *
   * Если поток для пользователя еще не создан,
   * создается новый Subject и сохраняется в памяти.
   *
   * @param userId - UUID пользователя.
   * @returns Observable с событиями уведомлений.
   */
  getStream(userId: string): Observable<MessageEvent> {
    let stream = this.streams.get(userId);

    if (!stream) {
      stream = new Subject<MessageEvent>();
      this.streams.set(userId, stream);
    }

    return stream.asObservable();
  }

  /**
   * Помечает уведомление пользователя как прочитанное.
   *
   * После изменения пересчитывает количество непрочитанных уведомлений
   * и отправляет актуальный счетчик через SSE.
   *
   * @param userId - UUID пользователя.
   * @param id - UUID уведомления.
   * @returns Результат выполнения операции.
   * @throws NotFoundException если уведомление не найдено,
   * не принадлежит пользователю или уже удалено.
   */
  async markAsRead(userId: string, id: string): Promise<{ success: true }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException("Notification not found");
    }

    await this.emitUnreadCount(userId);

    return { success: true };
  }

  /**
   * Выполняет soft-delete уведомления пользователя.
   *
   * Уведомление остается в базе данных,
   * но больше не возвращается в списке уведомлений.
   * После удаления пересчитывается счетчик непрочитанных.
   *
   * @param userId - UUID пользователя.
   * @param id - UUID уведомления.
   * @returns Результат выполнения операции.
   * @throws NotFoundException если уведомление не найдено,
   * не принадлежит пользователю или уже удалено.
   */
  async markAsDeleted(userId: string, id: string): Promise<{ success: true }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException("Notification not found");
    }

    await this.emitUnreadCount(userId);

    return { success: true };
  }

  /**
   * Создает новое уведомление для пользователя.
   *
   * После сохранения в базе данных уведомление отправляется
   * пользователю через SSE, а затем отправляется актуальный
   * счетчик непрочитанных уведомлений.
   *
   * Метод предназначен для внутреннего использования
   * другими backend-сервисами приложения.
   *
   * @param params - Данные нового уведомления.
   * @returns Созданное уведомление.
   */
  async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
      },
    });

    this.emit(params.userId, {
      type: "notification.created",
      data: notification,
    });

    await this.emitUnreadCount(params.userId);

    return notification;
  }

  /**
   * Пересчитывает количество непрочитанных уведомлений
   * и отправляет актуальное значение пользователю через SSE.
   *
   * @param userId - UUID пользователя.
   */
  private async emitUnreadCount(userId: string): Promise<void> {
    const { count } = await this.getUnreadCount(userId);

    this.emit(userId, {
      type: "notification.unread-count",
      data: {
        count,
      },
    });
  }

  /**
   * Публикует SSE-событие в поток конкретного пользователя.
   *
   * Если пользователь не подключен к SSE,
   * событие просто не отправляется.
   *
   * @param userId - UUID пользователя.
   * @param event - SSE-событие.
   */
  private emit(userId: string, event: MessageEvent): void {
    this.streams.get(userId)?.next(event);
  }
}
