import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  markSecurityEventSeenResponseSchema,
  unseenSecurityEventsResponseSchema,
} from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { registerSchema } from "../../common/openapi/zod-openapi";
import { SecurityEventsService } from "./security-events.service";

/**
 * Непросмотренные security-события текущего пользователя (plan D8).
 *
 * Путь вложен в `profile/me`, а не вынесен в отдельный `/security`, по той же
 * причине, что и эндпоинты отвязки (D4): домен — настройки аккаунта, а не
 * самостоятельная сущность. Это компенсирующий канал для событий, которые
 * не удалось доставить в Telegram; полноценный экран истории — вне объёма.
 */
@ApiTags("Security events")
@ApiBearerAuth()
@Controller("profile/me/security-events")
export class SecurityEventsController {
  constructor(private readonly securityEventsService: SecurityEventsService) {}

  /**
   * Возвращает непросмотренные и не доставленные в Telegram security-события.
   *
   * @param userId - UUID пользователя из JWT.
   * @returns Список событий `{ items }` без ip/user-agent.
   */
  @Get()
  @ApiOperation({ summary: "Получить непросмотренные security-события" })
  @ApiResponse({
    status: 200,
    description: "Непросмотренные security-события",
    schema: registerSchema(
      "UnseenSecurityEventsResponseDto",
      unseenSecurityEventsResponseSchema,
    ),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async getUnseen(@CurrentUser("sub") userId: string) {
    return this.securityEventsService.getUnseen(userId);
  }

  /**
   * Помечает security-событие просмотренным.
   *
   * @param userId - UUID пользователя из JWT.
   * @param id - UUID security-события.
   */
  @Post(":id/seen")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Отметить security-событие просмотренным" })
  @ApiParam({ name: "id", type: String, format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Событие отмечено просмотренным",
    schema: registerSchema(
      "MarkSecurityEventSeenResponseDto",
      markSecurityEventSeenResponseSchema,
    ),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 404, description: "Событие не найдено" })
  async markSeen(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    await this.securityEventsService.markSeen(userId, id);
    return { success: true as const };
  }
}
