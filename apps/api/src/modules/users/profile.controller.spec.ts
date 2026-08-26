import { ProfileController } from "./profile.controller";
import type { UsersService } from "./users.service";

describe("ProfileController", () => {
  let usersServiceMock: {
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
  };
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
    };
    controller = new ProfileController(
      usersServiceMock as unknown as UsersService,
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
});
