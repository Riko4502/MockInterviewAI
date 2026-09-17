import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type AdminUsersQueryDto,
  adminUsersQuerySchema,
  type CreateUserAdminDto,
  createUserAdminSchema,
  type PaginatedUsersAdminResponseDto,
  paginatedUsersAdminResponseSchema,
  type UpdateUserAdminDto,
  type UserAdminDetailResponseDto,
  type UserAdminResponseDto,
  type UserStatusAdminDto,
  updateUserAdminSchema,
  userAdminDetailResponseSchema,
  userAdminResponseSchema,
  userStatusAdminSchema,
} from "@packages/dto";
import { SystemPermission, SystemRole } from "@packages/types";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/permissions.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { registerSchema, ZodBody } from "../../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { AdminUsersService } from "../services/admin-users.service";

/**
 * Контроллер административного управления пользователями (`/api/v1/admin/users`).
 *
 * Доступен исключительно пользователям с ролью ADMIN и правом USERS_MANAGE.
 */
@ApiTags("Admin / Users")
@ApiBearerAuth()
@Roles(SystemRole.ADMIN)
@RequirePermissions(SystemPermission.USERS_MANAGE)
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  /**
   * Получает список пользователей с пагинацией, фильтрацией и сортировкой.
   */
  @Get()
  @ApiOperation({
    summary:
      "Получить пагинированный список пользователей с фильтрами и поиском",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Номер страницы (по умолчанию 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Количество записей на страницу (по умолчанию 20, макс. 100)",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Поиск по email, username или displayName",
  })
  @ApiQuery({
    name: "role",
    required: false,
    type: String,
    description: "Фильтр по роли пользователя (например, USER или ADMIN)",
  })
  @ApiQuery({
    name: "isActive",
    required: false,
    type: Boolean,
    description: "Фильтр по статусу активности",
  })
  @ApiQuery({
    name: "isDeleted",
    required: false,
    type: Boolean,
    description: "Фильтр по статусу удаления (soft-deleted)",
  })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: [
      "createdAt",
      "email",
      "username",
      "displayName",
      "role",
      "updatedAt",
    ],
    description: "Поле сортировки (по умолчанию createdAt)",
  })
  @ApiQuery({
    name: "sortOrder",
    required: false,
    enum: ["asc", "desc"],
    description: "Направление сортировки (по умолчанию desc)",
  })
  @ApiResponse({
    status: 200,
    description: "Пагинированный список пользователей",
    schema: registerSchema(
      "PaginatedUsersAdminResponseDto",
      paginatedUsersAdminResponseSchema,
    ),
  })
  @ApiResponse({
    status: 401,
    description: "Не авторизован",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен (недостаточно прав)",
  })
  async getUsersList(
    @Query(new ZodValidationPipe(adminUsersQuerySchema))
    query: AdminUsersQueryDto,
  ): Promise<PaginatedUsersAdminResponseDto> {
    return this.adminUsersService.getUsersList(query);
  }

  /**
   * Получает детальную информацию о пользователе.
   */
  @Get(":id")
  @ApiOperation({
    summary: "Получить детальную информацию о пользователе со статистикой",
  })
  @ApiParam({
    name: "id",
    type: String,
    description: "UUID пользователя",
  })
  @ApiResponse({
    status: 200,
    description: "Детальная информация о пользователе",
    schema: registerSchema(
      "UserAdminDetailResponseDto",
      userAdminDetailResponseSchema,
    ),
  })
  @ApiResponse({
    status: 401,
    description: "Не авторизован",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен",
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  async getUserById(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<UserAdminDetailResponseDto> {
    return this.adminUsersService.getUserById(id);
  }

  /**
   * Создает нового пользователя администратором.
   */
  @Post()
  @ApiOperation({
    summary: "Создать нового пользователя администратором",
  })
  @ZodBody(createUserAdminSchema, "CreateUserAdminDto")
  @ApiResponse({
    status: 201,
    description: "Пользователь успешно создан",
    schema: registerSchema("UserAdminResponseDto", userAdminResponseSchema),
  })
  @ApiResponse({
    status: 400,
    description: "Некорректные входные данные или роль не найдена",
  })
  @ApiResponse({
    status: 401,
    description: "Не авторизован",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен",
  })
  @ApiResponse({
    status: 409,
    description: "Email или username уже заняты",
  })
  async createUser(
    @Body(new ZodValidationPipe(createUserAdminSchema))
    dto: CreateUserAdminDto,
  ): Promise<UserAdminResponseDto> {
    return this.adminUsersService.createUser(dto);
  }

  /**
   * Обновляет данные и/или роль пользователя.
   */
  @Patch(":id")
  @ApiOperation({
    summary: "Обновить данные и/или роль пользователя",
  })
  @ApiParam({
    name: "id",
    type: String,
    description: "UUID пользователя",
  })
  @ZodBody(updateUserAdminSchema, "UpdateUserAdminDto")
  @ApiResponse({
    status: 200,
    description: "Данные пользователя успешно обновлены",
    schema: { $ref: "#/components/schemas/UserAdminResponseDto" },
  })
  @ApiResponse({
    status: 400,
    description: "Некорректные входные данные",
  })
  @ApiResponse({
    status: 401,
    description: "Не авторизован",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен",
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  @ApiResponse({
    status: 409,
    description: "Email или username уже заняты",
  })
  async updateUser(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateUserAdminSchema))
    dto: UpdateUserAdminDto,
    @CurrentUser("sub") currentAdminId: string,
  ): Promise<UserAdminResponseDto> {
    return this.adminUsersService.updateUser(id, dto, currentAdminId);
  }

  /**
   * Изменяет статус активности пользователя (активация / деактивация).
   */
  @Patch(":id/status")
  @ApiOperation({
    summary: "Активировать или деактивировать аккаунт пользователя",
  })
  @ApiParam({
    name: "id",
    type: String,
    description: "UUID пользователя",
  })
  @ZodBody(userStatusAdminSchema, "UserStatusAdminDto")
  @ApiResponse({
    status: 200,
    description: "Статус активности пользователя успешно изменен",
    schema: { $ref: "#/components/schemas/UserAdminResponseDto" },
  })
  @ApiResponse({
    status: 400,
    description: "Попытка деактивировать собственный аккаунт администратора",
  })
  @ApiResponse({
    status: 401,
    description: "Не авторизован",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен",
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  async updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(userStatusAdminSchema))
    dto: UserStatusAdminDto,
    @CurrentUser("sub") currentAdminId: string,
  ): Promise<UserAdminResponseDto> {
    return this.adminUsersService.updateStatus(id, dto, currentAdminId);
  }

  /**
   * Сбрасывает пароль пользователя и генерирует временный пароль.
   */
  @Post(":id/reset-password")
  @ApiOperation({
    summary: "Сбросить пароль пользователя и сгенерировать временный",
  })
  @ApiParam({
    name: "id",
    type: String,
    description: "UUID пользователя",
  })
  @ApiResponse({
    status: 200,
    description:
      "Пароль пользователя успешно сброшен, сгенерирован временный пароль",
    schema: { $ref: "#/components/schemas/UserAdminResponseDto" },
  })
  @ApiResponse({
    status: 401,
    description: "Не авторизован",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен",
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  async resetPassword(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<UserAdminResponseDto> {
    return this.adminUsersService.resetPassword(id);
  }

  /**
   * Удаляет (деактивирует) пользователя администратором.
   */
  @Delete(":id")
  @ApiOperation({
    summary: "Удалить (деактивировать) пользователя администратором",
  })
  @ApiParam({
    name: "id",
    type: String,
    description: "UUID пользователя",
  })
  @ApiResponse({
    status: 200,
    description: "Пользователь успешно удален",
    schema: { $ref: "#/components/schemas/UserAdminResponseDto" },
  })
  @ApiResponse({
    status: 400,
    description: "Попытка удалить собственный аккаунт администратора",
  })
  @ApiResponse({
    status: 401,
    description: "Не авторизован",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен",
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  async deleteUser(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser("sub") currentAdminId: string,
  ): Promise<UserAdminResponseDto> {
    return this.adminUsersService.deleteUser(id, currentAdminId);
  }

  /**
   * Восстанавливает ранее удаленного пользователя администратором.
   */
  @Post(":id/restore")
  @ApiOperation({
    summary: "Восстановить удаленного пользователя администратором",
  })
  @ApiParam({
    name: "id",
    type: String,
    description: "UUID пользователя",
  })
  @ApiResponse({
    status: 200,
    description: "Пользователь успешно восстановлен",
    schema: { $ref: "#/components/schemas/UserAdminResponseDto" },
  })
  @ApiResponse({
    status: 400,
    description: "Аккаунт пользователя не был удален",
  })
  @ApiResponse({
    status: 401,
    description: "Не авторизован",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен",
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  async restoreUser(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<UserAdminResponseDto> {
    return this.adminUsersService.restoreUser(id);
  }
}
