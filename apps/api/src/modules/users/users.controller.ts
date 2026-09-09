import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type PublicUserProfileDto,
  publicUserProfileSchema,
} from "@packages/dto";
import { registerSchema } from "../../common/openapi/zod-openapi";
import { UsersService } from "./users.service";

/**
 * Публичный контроллер пользователей (`/api/v1/users`).
 */
@ApiTags("Users")
@ApiBearerAuth()
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
  @ApiOperation({
    summary: "Получить публичный профиль пользователя по UUID или username",
  })
  @ApiParam({
    name: "idOrUsername",
    description: "UUID пользователя или username",
    type: "string",
  })
  @ApiResponse({
    status: 200,
    description: "Публичный профиль пользователя",
    schema: registerSchema("PublicUserProfileDto", publicUserProfileSchema),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 404, description: "Пользователь не найден" })
  async getPublicProfile(
    @Param("idOrUsername") idOrUsername: string,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicProfile(idOrUsername);
  }
}
