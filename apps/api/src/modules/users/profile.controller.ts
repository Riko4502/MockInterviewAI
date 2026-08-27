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
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  type UpdateProfileDto,
  type UserProfileDto,
  updateProfileSchema,
} from "@packages/dto";
import type { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { UsersService } from "./users.service";

/**
 * Контроллер профиля текущего пользователя (`/api/v1/profile`).
 */
@Controller("profile")
@UseGuards(JwtAuthGuard)
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
