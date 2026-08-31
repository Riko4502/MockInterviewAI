import { Controller, Get, Param } from "@nestjs/common";
import type { PublicUserProfileDto } from "@packages/dto";
import { UsersService } from "./users.service";

/**
 * Публичный контроллер пользователей (`/api/v1/users`).
 */
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Получает публичный профиль пользователя по UUID или username.
   *
   * @param idOrUsername - UUID пользователя или username.
   * @returns Публичный профиль пользователя.
   */
  @Get(":idOrUsername")
  async getPublicProfile(
    @Param("idOrUsername") idOrUsername: string,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicProfile(idOrUsername);
  }
}
