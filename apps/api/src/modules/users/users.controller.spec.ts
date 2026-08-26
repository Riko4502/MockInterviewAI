import { UsersController } from "./users.controller";
import type { UsersService } from "./users.service";

describe("UsersController", () => {
  let usersServiceMock: {
    getPublicProfile: jest.Mock;
  };
  let controller: UsersController;

  const mockPublicProfile = {
    id: "11111111-1111-4111-a111-111111111111",
    displayName: "Public User",
    username: "public_user",
    avatarUrl: null,
    telegramUsername: "public_tg",
    gitUrl: "https://gitlab.com/public_user",
    createdAt: new Date(),
  };

  beforeEach(() => {
    usersServiceMock = {
      getPublicProfile: jest.fn().mockResolvedValue(mockPublicProfile),
    };
    controller = new UsersController(
      usersServiceMock as unknown as UsersService,
    );
  });

  it("getPublicProfile возвращает публичный профиль", async () => {
    const result = await controller.getPublicProfile("public_user");

    expect(usersServiceMock.getPublicProfile).toHaveBeenCalledWith(
      "public_user",
    );
    expect(result).toEqual(mockPublicProfile);
  });
});
