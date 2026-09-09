import type { MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";

import { NotificationsController } from "./notifications.controller";
import type { NotificationsService } from "./notifications.service";

describe("NotificationsController", () => {
  let notificationsServiceMock: {
    getNotifications: jest.Mock;
    getUnreadCount: jest.Mock;
    getStream: jest.Mock;
    markAsRead: jest.Mock;
    markAsDeleted: jest.Mock;
  };

  let controller: NotificationsController;

  const userId = "11111111-1111-4111-a111-111111111111";
  const notificationId = "22222222-2222-4222-a222-222222222222";

  const mockNotification = {
    id: notificationId,
    userId,
    type: "INTERVIEW",
    title: "Новое уведомление",
    message: "Тестовое уведомление",
    readAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    notificationsServiceMock = {
      getNotifications: jest.fn().mockResolvedValue([mockNotification]),
      getUnreadCount: jest.fn().mockResolvedValue({ count: 1 }),
      getStream: jest.fn(),
      markAsRead: jest.fn().mockResolvedValue({ success: true }),
      markAsDeleted: jest.fn().mockResolvedValue({ success: true }),
    };

    controller = new NotificationsController(
      notificationsServiceMock as unknown as NotificationsService,
    );
  });

  it("getNotifications возвращает уведомления текущего пользователя", async () => {
    const result = await controller.getNotifications(userId);

    expect(notificationsServiceMock.getNotifications).toHaveBeenCalledWith(
      userId,
    );

    expect(result).toEqual([mockNotification]);
  });

  it("getUnreadCount возвращает количество непрочитанных уведомлений", async () => {
    const result = await controller.getUnreadCount(userId);

    expect(notificationsServiceMock.getUnreadCount).toHaveBeenCalledWith(
      userId,
    );

    expect(result).toEqual({ count: 1 });
  });

  it("stream возвращает SSE поток текущего пользователя", () => {
    const streamMock = {} as Observable<MessageEvent>;

    notificationsServiceMock.getStream.mockReturnValue(streamMock);

    const result = controller.stream(userId);

    expect(notificationsServiceMock.getStream).toHaveBeenCalledWith(userId);

    expect(result).toBe(streamMock);
  });

  it("markAsRead помечает уведомление прочитанным", async () => {
    const result = await controller.markAsRead(userId, notificationId);

    expect(notificationsServiceMock.markAsRead).toHaveBeenCalledWith(
      userId,
      notificationId,
    );

    expect(result).toEqual({ success: true });
  });

  it("markAsDeleted помечает уведомление удаленным", async () => {
    const result = await controller.markAsDeleted(userId, notificationId);

    expect(notificationsServiceMock.markAsDeleted).toHaveBeenCalledWith(
      userId,
      notificationId,
    );

    expect(result).toEqual({ success: true });
  });
});
