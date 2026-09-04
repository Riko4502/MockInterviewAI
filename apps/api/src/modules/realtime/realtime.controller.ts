import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { type TicketDto, ticketSchema } from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { registerSchema, ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthThrottlerGuard } from "../auth/guards/auth-throttler.guard";
import { TokenService } from "../auth/services/token.service";

/**
 * Контроллер выдачи одноразовых тикетов для WebSocket (`/api/v1/realtime`).
 *
 * `POST /realtime/ticket` подписывает JWT `typ:"realtime"` (TTL 5м), который
 * realtime-сервис принимает по `Sec-WebSocket-Protocol`. Маршрут защищён
 * глобальным `AccessTokenGuard` (Bearer + live `auth:session:{sid}`).
 *
 * Ограничение частоты — `AuthThrottlerGuard` с tracker по IP (в теле тикета
 * email отсутствует).
 */
@ApiTags("Realtime")
@ApiBearerAuth()
@Controller("realtime")
@UseGuards(AuthThrottlerGuard)
export class RealtimeController {
  constructor(private readonly tokenService: TokenService) {}

  /**
   * Выдаёт одноразовый тикет для подключения к комнате интервью-сессии.
   *
   * @param body - Валидированные `{ sessionId }` (UUID).
   * @param userId - UUID текущего пользователя (`sub`).
   * @param sid - UUID текущей auth-сессии (`sid`).
   * @returns `{ ticket }` — JWT `typ:"realtime"`.
   */
  @Post("ticket")
  @ApiOperation({
    summary: "Выдать одноразовый тикет для подключения к WebSocket комнате",
  })
  @ZodBody(ticketSchema, "TicketDto")
  @ApiResponse({
    status: 201,
    description: "Тикет успешно выпущен",
    schema: registerSchema("TicketResponseDto", {
      type: "object",
      properties: {
        ticket: {
          type: "string",
          description: "JWT тикет для аутентификации в WebSocket",
        },
      },
      required: ["ticket"],
    }),
  })
  @ApiResponse({ status: 400, description: "Ошибка валидации входных данных" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({
    status: 429,
    description: "Превышен лимит запросов (rate limit)",
  })
  async getTicket(
    @Body(new ZodValidationPipe(ticketSchema)) body: TicketDto,
    @CurrentUser("sub") userId: string,
    @CurrentUser("sid") sid: string,
  ): Promise<{ ticket: string }> {
    const ticket = this.tokenService.generateRealtimeTicket(
      userId,
      sid,
      body.sessionId,
    );
    return { ticket };
  }
}
