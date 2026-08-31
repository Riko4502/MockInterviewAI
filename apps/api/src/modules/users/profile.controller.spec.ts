import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { ProfileController } from "./profile.controller";
import type { UsersService } from "./users.service";

describe("ProfileController", () => {
  let usersServiceMock: {
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
    updateAvatar: jest.Mock;
    deleteAvatar: jest.Mock;
    deactivateAccount: jest.Mock;
    restoreAccount: jest.Mock;
  };
  let configServiceMock: jest.Mocked<Partial<ConfigService>>;
  let responseMock: { clearCookie: jest.Mock };
  let controller: ProfileController;

  const mockProfile = {
    id: "11111111-1111-4111-a111-111111111111",
    email: "test@example.com",
    displayName: "Test User",
    username: "test_user",
    avatarUrl: null,
    telegramUsername: "test_tg",
    gitUrl: "https://github.com/test",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    usersServiceMock = {
      getProfile: jest.fn().mockResolvedValue(mockProfile),
      updateProfile: jest.fn().mockResolvedValue({
        ...mockProfile,
        displayName: "Updated User",
      }),
      updateAvatar: jest.fn().mockResolvedValue({
        avatarUrl: "https://s3.example.com/avatar.webp",
      }),
      deleteAvatar: jest.fn().mockResolvedValue(undefined),
      deactivateAccount: jest.fn().mockResolvedValue(undefined),
      restoreAccount: jest.fn().mockResolvedValue(mockProfile),
    };
    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "cookie.refreshTokenName") return "refresh_token";
        return null;
      }),
    };
    responseMock = {
      clearCookie: jest.fn(),
    };

    controller = new ProfileController(
      usersServiceMock as unknown as UsersService,
      configServiceMock as ConfigService,
    );
  });

  it("getMyProfile возвращает профиль текущего пользователя", async () => {
    const result = await controller.getMyProfile(mockProfile.id);

    expect(usersServiceMock.getProfile).toHaveBeenCalledWith(mockProfile.id);
    expect(result).toEqual(mockProfile);
  });

  it("updateMyProfile передает DTO в usersService", async () => {
    const updateDto = { displayName: "Updated User" };
    const result = await controller.updateMyProfile(mockProfile.id, updateDto);

    expect(usersServiceMock.updateProfile).toHaveBeenCalledWith(
      mockProfile.id,
      updateDto,
    );
    expect(result.displayName).toBe("Updated User");
  });

  it("uploadAvatar передает файл в usersService", async () => {
    const file = { buffer: Buffer.from("test") } as Express.Multer.File;
    const result = await controller.uploadAvatar(mockProfile.id, file);

    expect(usersServiceMock.updateAvatar).toHaveBeenCalledWith(
      mockProfile.id,
      file,
    );
    expect(result).toEqual({ avatarUrl: "https://s3.example.com/avatar.webp" });
  });

  it("deleteAvatar обнуляет аватар", async () => {
    const result = await controller.deleteAvatar(mockProfile.id);

    expect(usersServiceMock.deleteAvatar).toHaveBeenCalledWith(mockProfile.id);
    expect(result).toEqual({ avatarUrl: null });
  });

  it("deleteMyProfile деактивирует аккаунт и очищает refresh cookie", async () => {
    const result = await controller.deleteMyProfile(
      mockProfile.id,
      "session-123",
      responseMock as unknown as Response,
    );

    expect(usersServiceMock.deactivateAccount).toHaveBeenCalledWith(
      mockProfile.id,
      "session-123",
    );
    expect(responseMock.clearCookie).toHaveBeenCalledTimes(1);
    expect(responseMock.clearCookie).toHaveBeenCalledWith("refresh_token", {
      path: "/api/v1/auth",
    });
    expect(result.message).toContain("deactivated");
  });

  it("restoreMyProfile восстанавливает аккаунт", async () => {
    const result = await controller.restoreMyProfile(mockProfile.id);

    expect(usersServiceMock.restoreAccount).toHaveBeenCalledWith(
      mockProfile.id,
    );
    expect(result.profile).toEqual(mockProfile);
  });
});
