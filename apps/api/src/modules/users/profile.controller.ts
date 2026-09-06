import "multer";
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type UpdateProfileDto,
  type UserProfileDto,
  updateProfileSchema,
  userProfileSchema,
} from "@packages/dto";
import type { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { registerSchema, ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";

/**
 * Контроллер профиля текущего пользователя (`/api/v1/profile`).
 */
@ApiTags("Profile")
@ApiBearerAuth()
@Controller("profile")
export class ProfileController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Получает профиль текущего авторизованного пользователя.
   *
   * @param userId - UUID пользователя из JWT токена.
   * @returns Полный объект профиля.
   */
  @Get("me")
  @ApiOperation({
    summary: "Получить профиль текущего авторизованного пользователя",
  })
  @ApiResponse({
    status: 200,
    description: "Профиль текущего пользователя",
    schema: registerSchema("UserProfileDto", userProfileSchema),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async getMyProfile(
    @CurrentUser("sub") userId: string,
  ): Promise<UserProfileDto> {
    return this.usersService.getProfile(userId);
  }

  /**
   * Обновляет профиль текущего пользователя.
   *
   * @param userId - UUID пользователя из JWT токена.
   * @param dto - Валидированные поля профиля.
   * @returns Обновленный профиль.
   */
  @Patch("me")
  @ApiOperation({ summary: "Обновить профиль текущего пользователя" })
  @ZodBody(updateProfileSchema, "UpdateProfileDto")
  @ApiResponse({
    status: 200,
    description: "Обновленный профиль пользователя",
    schema: { $ref: "#/components/schemas/UserProfileDto" },
  })
  @ApiResponse({ status: 400, description: "Ошибка валидации входных данных" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async updateMyProfile(
    @CurrentUser("sub") userId: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.usersService.updateProfile(userId, dto);
  }

  /**
   * Загружает и обновляет аватар профиля в S3/MinIO.
   *
   * @param userId - UUID пользователя.
   * @param file - Загруженный файл (multer).
   * @returns Объект с новым URL аватара.
   */
  @Post("avatar")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Загрузить аватар профиля" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
      required: ["file"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Аватар успешно загружен",
    schema: registerSchema("AvatarUploadResponseDto", {
      type: "object",
      properties: {
        avatarUrl: { type: "string" },
      },
      required: ["avatarUrl"],
    }),
  })
  @ApiResponse({ status: 400, description: "Некорректный файл аватара" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async uploadAvatar(
    @CurrentUser("sub") userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    return this.usersService.updateAvatar(userId, file);
  }

  /**
   * Удаляет текущий аватар профиля из S3.
   *
   * @param userId - UUID пользователя.
   */
  @Delete("avatar")
  @ApiOperation({ summary: "Удалить аватар профиля" })
  @ApiResponse({
    status: 200,
    description: "Аватар успешно удален",
    schema: registerSchema("AvatarDeleteResponseDto", {
      type: "object",
      properties: {
        avatarUrl: { type: "string", nullable: true },
      },
      required: ["avatarUrl"],
    }),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async deleteAvatar(
    @CurrentUser("sub") userId: string,
  ): Promise<{ avatarUrl: null }> {
    await this.usersService.deleteAvatar(userId);
    return { avatarUrl: null };
  }

  /**
   * Деактивирует аккаунт (soft-delete с 30-дневным окном восстановления).
   *
   * @param userId - UUID пользователя.
   * @param sessionId - ID текущей сессии.
   * @param response - Express Response для очистки cookie.
   */
  @Delete("me")
  @ApiOperation({ summary: "Деактивировать аккаунт текущего пользователя" })
  @ApiResponse({
    status: 200,
    description: "Аккаунт успешно деактивирован",
    schema: registerSchema("MessageResponseDto", {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      required: ["message"],
    }),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async deleteMyProfile(
    @CurrentUser("sub") userId: string,
    @CurrentUser("sid") sessionId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    await this.usersService.deactivateAccount(userId, sessionId);

    const refreshTokenName =
      this.configService.get<string>("cookie.refreshTokenName") ??
      "refresh_token";

    response.clearCookie(refreshTokenName, { path: "/api/v1/auth" });

    return {
      message:
        "Account successfully deactivated. You can restore it within 30 days.",
    };
  }

  /**
   * Восстанавливает деактивированный аккаунт в течение 30 дней.
   *
   * @param userId - UUID пользователя.
   * @returns Восстановленный профиль.
   */
  @Post("restore")
  @ApiOperation({ summary: "Восстановить деактивированный аккаунт" })
  @ApiResponse({
    status: 201,
    description: "Аккаунт успешно восстановлен",
    schema: registerSchema("RestoreProfileResponseDto", {
      type: "object",
      properties: {
        message: { type: "string" },
        profile: { $ref: "#/components/schemas/UserProfileDto" },
      },
      required: ["message", "profile"],
    }),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async restoreMyProfile(
    @CurrentUser("sub") userId: string,
  ): Promise<{ message: string; profile: UserProfileDto }> {
    const profile = await this.usersService.restoreAccount(userId);
    return {
      message: "Account successfully restored",
      profile,
    };
  }
}
