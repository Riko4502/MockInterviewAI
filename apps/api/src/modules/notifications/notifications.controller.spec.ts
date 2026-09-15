import { BadRequestException } from "@nestjs/common";

import { NotificationsController } from "./notifications.controller";
import type { NotificationsService } from "./notifications.service";

describe("NotificationsController", () => {
  let notificationsServiceMock: {
    getNotifications: jest.Mock;
    getUnreadCount: jest.Mock;
    markAllAsRead: jest.Mock;
    markAsRead: jest.Mock;
    markAsDeleted: jest.Mock;
  };

  let controller: NotificationsController;

  const userId = "11111111-1111-4111-a111-111111111111";

  const notificationId = "22222222-2222-4222-a222-222222222222";

  const mockNotification = {
    id: notificationId,
    userId,
    category: "INTERVIEW",
    title: "Новое уведомление",
    message: "Тестовое уведомление",
    actionUrl: "/interviews/123",
    readAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const paginatedNotifications = {
    items: [mockNotification],
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  };

  beforeEach(() => {
    notificationsServiceMock = {
      getNotifications: jest.fn().mockResolvedValue(paginatedNotifications),

      getUnreadCount: jest.fn().mockResolvedValue({ count: 1 }),

      markAllAsRead: jest.fn().mockResolvedValue({ success: true }),

      markAsRead: jest.fn().mockResolvedValue({ success: true }),

      markAsDeleted: jest.fn().mockResolvedValue({ success: true }),
    };

    controller = new NotificationsController(
      notificationsServiceMock as unknown as NotificationsService,
    );
  });

  describe("getNotifications", () => {
    it("возвращает пагинированные уведомления текущего пользователя", async () => {
      const page = 1;
      const limit = 20;

      const result = await controller.getNotifications(userId, page, limit);

      expect(notificationsServiceMock.getNotifications).toHaveBeenCalledWith(
        userId,
        page,
        limit,
      );

      expect(result).toEqual(paginatedNotifications);
    });

    it("принимает минимально допустимое значение page", async () => {
      await controller.getNotifications(userId, 1, 20);

      expect(notificationsServiceMock.getNotifications).toHaveBeenCalledWith(
        userId,
        1,
        20,
      );
    });

    it("принимает минимально допустимое значение limit", async () => {
      await controller.getNotifications(userId, 1, 1);

      expect(notificationsServiceMock.getNotifications).toHaveBeenCalledWith(
        userId,
        1,
        1,
      );
    });

    it("принимает максимально допустимое значение limit", async () => {
      await controller.getNotifications(userId, 1, 100);

      expect(notificationsServiceMock.getNotifications).toHaveBeenCalledWith(
        userId,
        1,
        100,
      );
    });

    it("выбрасывает BadRequestException если page равен 0", async () => {
      await expect(controller.getNotifications(userId, 0, 20)).rejects.toThrow(
        BadRequestException,
      );

      expect(notificationsServiceMock.getNotifications).not.toHaveBeenCalled();
    });

    it("выбрасывает BadRequestException если page меньше 0", async () => {
      await expect(controller.getNotifications(userId, -1, 20)).rejects.toThrow(
        BadRequestException,
      );

      expect(notificationsServiceMock.getNotifications).not.toHaveBeenCalled();
    });

    it("выбрасывает BadRequestException если limit равен 0", async () => {
      await expect(controller.getNotifications(userId, 1, 0)).rejects.toThrow(
        BadRequestException,
      );

      expect(notificationsServiceMock.getNotifications).not.toHaveBeenCalled();
    });

    it("выбрасывает BadRequestException если limit больше 100", async () => {
      await expect(controller.getNotifications(userId, 1, 101)).rejects.toThrow(
        BadRequestException,
      );

      expect(notificationsServiceMock.getNotifications).not.toHaveBeenCalled();
    });
  });

  describe("getUnreadCount", () => {
    it("возвращает количество непрочитанных уведомлений", async () => {
      const result = await controller.getUnreadCount(userId);

      expect(notificationsServiceMock.getUnreadCount).toHaveBeenCalledWith(
        userId,
      );

      expect(result).toEqual({
        count: 1,
      });
    });
  });

  describe("markAllAsRead", () => {
    it("помечает все непрочитанные уведомления пользователя прочитанными", async () => {
      const result = await controller.markAllAsRead(userId);

      expect(notificationsServiceMock.markAllAsRead).toHaveBeenCalledWith(
        userId,
      );

      expect(result).toEqual({
        success: true,
      });
    });
  });

  describe("markAsRead", () => {
    it("помечает уведомление прочитанным", async () => {
      const result = await controller.markAsRead(userId, notificationId);

      expect(notificationsServiceMock.markAsRead).toHaveBeenCalledWith(
        userId,
        notificationId,
      );

      expect(result).toEqual({
        success: true,
      });
    });
  });

  describe("markAsDeleted", () => {
    it("помечает уведомление удаленным", async () => {
      const result = await controller.markAsDeleted(userId, notificationId);

      expect(notificationsServiceMock.markAsDeleted).toHaveBeenCalledWith(
        userId,
        notificationId,
      );

      expect(result).toEqual({
        success: true,
      });
    });
  });
});
