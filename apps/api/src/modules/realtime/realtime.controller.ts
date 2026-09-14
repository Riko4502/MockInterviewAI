import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type MediaTokenRequestDto,
  mediaTokenRequestSchema,
  type TicketDto,
  ticketSchema,
} from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { registerSchema, ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { InterviewParticipantRole } from "../../generated/prisma/enums";
import { RedisService } from "../../redis/redis.service";
import { AuthThrottlerGuard } from "../auth/guards/auth-throttler.guard";
import { TokenService } from "../auth/services/token.service";
import { sessionActiveKey, sessionMembersKey } from "../sessions/session-keys";
import { SessionsService } from "../sessions/sessions.service";
import { LivekitService } from "./livekit.service";

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
  constructor(
    private readonly tokenService: TokenService,
    private readonly livekitService: LivekitService,
    private readonly redisService: RedisService,
    private readonly sessionsService: SessionsService,
  ) {}

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
    status: 403,
    description: "Сессия не активна или пользователь не является участником",
  })
  @ApiResponse({
    status: 429,
    description: "Превышен лимит запросов (rate limit)",
  })
  async getTicket(
    @Body(new ZodValidationPipe(ticketSchema)) body: TicketDto,
    @CurrentUser("sub") userId: string,
    @CurrentUser("sid") sid: string,
  ): Promise<{ ticket: string }> {
    const sessionId = body.sessionId;
    const activeKey = sessionActiveKey(sessionId);
    const membersKey = sessionMembersKey(sessionId);

    // Проверяем активность сессии в Redis
    const active = await this.redisService.get(activeKey);
    if (active !== "true") {
      throw new ForbiddenException(
        "Interview session is not active or does not exist",
      );
    }

    // Проверяем, что пользователь является зарегистрированным участником сессии
    let role = await this.redisService.hget(membersKey, userId);
    if (!role) {
      // Присоединение по ссылке: если сессия активна, регистрируем участника как кандидата
      try {
        await this.sessionsService.addParticipant(
          sessionId,
          userId,
          InterviewParticipantRole.CANDIDATE,
        );
        role = InterviewParticipantRole.CANDIDATE;
      } catch {
        throw new ForbiddenException(
          "User is not a participant of this interview session",
        );
      }
    }

    const ticket = this.tokenService.generateRealtimeTicket(
      userId,
      sid,
      body.sessionId,
    );
    return { ticket };
  }

  /**
   * Выдаёт LiveKit join-токен для WebRTC медиа (аудио/видео интервью).
   *
   * @param body - Валидированные `{ sessionId }` (UUID).
   * @param userId - UUID текущего пользователя (`sub`).
   * @returns `{ token, serverUrl, roomName }`.
   */
  @Post("media-token")
  @ApiOperation({
    summary: "Выдать LiveKit join-токен для WebRTC медиа",
  })
  @ZodBody(mediaTokenRequestSchema, "MediaTokenRequestDto")
  @ApiResponse({
    status: 201,
    description: "LiveKit токен успешно выпущен",
    schema: registerSchema("MediaTokenResponseDto", {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "LiveKit access token (JWT) для подключения к SFU",
        },
        serverUrl: {
          type: "string",
          description: "URL LiveKit сервера для подключения",
        },
        roomName: {
          type: "string",
          description: "Название комнаты (совпадает с sessionId)",
        },
      },
      required: ["token", "serverUrl", "roomName"],
    }),
  })
  @ApiResponse({ status: 400, description: "Ошибка валидации входных данных" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({
    status: 403,
    description: "Сессия не активна или пользователь не является участником",
  })
  @ApiResponse({
    status: 429,
    description: "Превышен лимит запросов (rate limit)",
  })
  async getMediaToken(
    @Body(new ZodValidationPipe(mediaTokenRequestSchema))
    body: MediaTokenRequestDto,
    @CurrentUser("sub") userId: string,
  ) {
    const sessionId = body.sessionId;
    const activeKey = sessionActiveKey(sessionId);
    const membersKey = sessionMembersKey(sessionId);

    // Проверяем активность сессии в Redis
    const active = await this.redisService.get(activeKey);
    if (active !== "true") {
      throw new ForbiddenException(
        "Interview session is not active or does not exist",
      );
    }

    // Проверяем, что пользователь является зарегистрированным участником сессии
    let role = await this.redisService.hget(membersKey, userId);
    if (!role) {
      try {
        await this.sessionsService.addParticipant(
          sessionId,
          userId,
          InterviewParticipantRole.CANDIDATE,
        );
        role = InterviewParticipantRole.CANDIDATE;
      } catch {
        throw new ForbiddenException(
          "User is not a participant of this interview session",
        );
      }
    }

    return this.livekitService.generateMediaToken(userId, body.sessionId);
  }
}
