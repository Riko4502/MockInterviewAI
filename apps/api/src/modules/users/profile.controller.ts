import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import {
  type UpdateProfileDto,
  type UserProfileDto,
  updateProfileSchema,
} from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";

/**
 * Контроллер профиля текущего пользователя (`/api/v1/profile`).
 */
@Controller("profile")
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

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
}
