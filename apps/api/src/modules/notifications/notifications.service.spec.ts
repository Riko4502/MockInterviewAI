import { NotFoundException } from "@nestjs/common";

import { NotificationType } from "../../generated/prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  let prismaMock: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };

  let service: NotificationsService;

  const userId = "11111111-1111-4111-a111-111111111111";
  const notificationId = "22222222-2222-4222-a222-222222222222";

  const mockNotification = {
    id: notificationId,
    userId,
    type: NotificationType.INTERVIEW,
    title: "Новое уведомление",
    message: "Тестовое уведомление",
    readAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prismaMock = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };

    service = new NotificationsService(prismaMock as unknown as PrismaService);
  });

  it("getNotifications получает только неудаленные уведомления пользователя от новых к старым", async () => {
    prismaMock.notification.findMany.mockResolvedValue([mockNotification]);

    const result = await service.getNotifications(userId);

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    expect(result).toEqual([mockNotification]);
  });

  it("getUnreadCount считает только непрочитанные и неудаленные уведомления", async () => {
    prismaMock.notification.count.mockResolvedValue(3);

    const result = await service.getUnreadCount(userId);

    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: {
        userId,
        readAt: null,
        deletedAt: null,
      },
    });

    expect(result).toEqual({ count: 3 });
  });

  it("markAsRead помечает уведомление прочитанным", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({
      count: 1,
    });

    prismaMock.notification.count.mockResolvedValue(0);

    const result = await service.markAsRead(userId, notificationId);

    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        userId,
        deletedAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    });

    expect(result).toEqual({ success: true });
  });

  it("markAsRead выбрасывает NotFoundException если уведомление не найдено", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(service.markAsRead(userId, notificationId)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.notification.count).not.toHaveBeenCalled();
  });

  it("markAsDeleted выполняет soft-delete уведомления", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({
      count: 1,
    });

    prismaMock.notification.count.mockResolvedValue(0);

    const result = await service.markAsDeleted(userId, notificationId);

    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: expect.any(Date),
      },
    });

    expect(result).toEqual({ success: true });
  });

  it("markAsDeleted выбрасывает NotFoundException если уведомление не найдено", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(service.markAsDeleted(userId, notificationId)).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.notification.count).not.toHaveBeenCalled();
  });

  it("createNotification сохраняет уведомление в БД", async () => {
    prismaMock.notification.create.mockResolvedValue(mockNotification);

    prismaMock.notification.count.mockResolvedValue(1);

    const result = await service.createNotification({
      userId,
      type: NotificationType.INTERVIEW,
      title: "Новое уведомление",
      message: "Тестовое уведомление",
    });

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId,
        type: NotificationType.INTERVIEW,
        title: "Новое уведомление",
        message: "Тестовое уведомление",
      },
    });

    expect(result).toEqual(mockNotification);
  });

  it("getStream возвращает Observable для пользователя", () => {
    const stream = service.getStream(userId);

    expect(stream).toBeDefined();
    expect(typeof stream.subscribe).toBe("function");
  });

  it("для разных пользователей создаются разные SSE потоки", () => {
    const firstStream = service.getStream(userId);

    const secondStream = service.getStream(
      "33333333-3333-4333-a333-333333333333",
    );

    expect(firstStream).not.toBe(secondStream);
  });

  it("createNotification отправляет новое уведомление и счетчик через SSE", async () => {
    prismaMock.notification.create.mockResolvedValue(mockNotification);

    prismaMock.notification.count.mockResolvedValue(1);

    const events: unknown[] = [];

    const subscription = service.getStream(userId).subscribe((event) => {
      events.push(event);
    });

    await service.createNotification({
      userId,
      type: NotificationType.INTERVIEW,
      title: "Новое уведомление",
      message: "Тестовое уведомление",
    });

    expect(events).toEqual([
      {
        type: "notification.created",
        data: mockNotification,
      },
      {
        type: "notification.unread-count",
        data: {
          count: 1,
        },
      },
    ]);

    subscription.unsubscribe();
  });
});
