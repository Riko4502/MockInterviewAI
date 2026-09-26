import type {
  AdminUsersQueryDto,
  CreateUserAdminDto,
  UpdateUserAdminDto,
  UserAdminResponseDto,
  UserStatusAdminDto,
} from "@packages/dto";
import type { AdminUsersService } from "../services/admin-users.service";
import { AdminUsersController } from "./admin-users.controller";

describe("AdminUsersController", () => {
  let controller: AdminUsersController;
  let serviceMock: jest.Mocked<
    Pick<
      AdminUsersService,
      | "getUsersList"
      | "getUserById"
      | "createUser"
      | "updateUser"
      | "updateStatus"
      | "resetPassword"
      | "deleteUser"
      | "restoreUser"
    >
  >;

  const mockUserResponse: UserAdminResponseDto = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    email: "user@example.com",
    username: "alex_dev",
    displayName: "Alex Developer",
    role: "USER",
    isActive: true,
    deactivatedAt: null,
    deletedAt: null,
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z",
  };

  beforeEach(() => {
    serviceMock = {
      getUsersList: jest.fn().mockResolvedValue({
        items: [mockUserResponse],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
      getUserById: jest.fn().mockResolvedValue({
        ...mockUserResponse,
        sessionsCount: 3,
        participationsCount: 5,
      }),
      createUser: jest.fn().mockResolvedValue(mockUserResponse),
      updateUser: jest.fn().mockResolvedValue({
        ...mockUserResponse,
        displayName: "Updated Alex",
      }),
      updateStatus: jest.fn().mockResolvedValue({
        ...mockUserResponse,
        isActive: false,
        deactivatedAt: "2026-09-18T09:00:00.000Z",
      }),
      resetPassword: jest.fn().mockResolvedValue(mockUserResponse),
      deleteUser: jest.fn().mockResolvedValue({
        ...mockUserResponse,
        deletedAt: "2026-09-18T09:00:00.000Z",
        isActive: false,
      }),
      restoreUser: jest.fn().mockResolvedValue({
        ...mockUserResponse,
        deletedAt: null,
        deactivatedAt: null,
        isActive: true,
      }),
    };

    controller = new AdminUsersController(
      serviceMock as unknown as AdminUsersService,
    );
  });

  it("getUsersList делегирует вызов сервису", async () => {
    const query: AdminUsersQueryDto = {
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    };
    const result = await controller.getUsersList(query);

    expect(serviceMock.getUsersList).toHaveBeenCalledWith(query);
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it("getUserById делегирует вызов сервису с UUID", async () => {
    const result = await controller.getUserById(mockUserResponse.id);

    expect(serviceMock.getUserById).toHaveBeenCalledWith(mockUserResponse.id);
    expect(result.id).toBe(mockUserResponse.id);
    expect(result.sessionsCount).toBe(3);
  });

  it("createUser делегирует вызов сервису", async () => {
    const dto: CreateUserAdminDto = {
      email: "new@example.com",
      role: "USER",
      isActive: true,
    };
    const result = await controller.createUser(dto);

    expect(serviceMock.createUser).toHaveBeenCalledWith(dto);
    expect(result.id).toBe(mockUserResponse.id);
  });

  it("updateUser передает id, dto и currentAdminId сервису", async () => {
    const adminId = "admin-uuid-123";
    const dto: UpdateUserAdminDto = { displayName: "Updated Alex" };
    const result = await controller.updateUser(
      mockUserResponse.id,
      dto,
      adminId,
    );

    expect(serviceMock.updateUser).toHaveBeenCalledWith(
      mockUserResponse.id,
      dto,
      adminId,
    );
    expect(result.displayName).toBe("Updated Alex");
  });

  it("updateStatus передает id, dto и currentAdminId сервису", async () => {
    const adminId = "admin-uuid-123";
    const dto: UserStatusAdminDto = { isActive: false };
    const result = await controller.updateStatus(
      mockUserResponse.id,
      dto,
      adminId,
    );

    expect(serviceMock.updateStatus).toHaveBeenCalledWith(
      mockUserResponse.id,
      dto,
      adminId,
    );
    expect(result.isActive).toBe(false);
  });

  it("resetPassword передает id сервису", async () => {
    const result = await controller.resetPassword(mockUserResponse.id);

    expect(serviceMock.resetPassword).toHaveBeenCalledWith(mockUserResponse.id);
    expect(result.id).toBe(mockUserResponse.id);
  });

  it("deleteUser передает id и currentAdminId сервису", async () => {
    const adminId = "admin-uuid-123";
    const result = await controller.deleteUser(mockUserResponse.id, adminId);

    expect(serviceMock.deleteUser).toHaveBeenCalledWith(
      mockUserResponse.id,
      adminId,
    );
    expect(result.isActive).toBe(false);
  });

  it("restoreUser передает id сервису", async () => {
    const result = await controller.restoreUser(mockUserResponse.id);

    expect(serviceMock.restoreUser).toHaveBeenCalledWith(mockUserResponse.id);
    expect(result.isActive).toBe(true);
  });
});
