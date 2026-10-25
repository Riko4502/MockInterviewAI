import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Optional,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type AddParticipantDto,
  addParticipantSchema,
  type CreateMeetingDto,
  type CreateSessionResponseDto,
  createMeetingSchema,
  type InterviewParticipantRole,
  type JoinMeetingDto,
  type JoinMeetingResponseDto,
  type JoinSessionDto,
  type JoinSessionResponseDto,
  joinMeetingSchema,
  joinSessionSchema,
  type MeetingLobbyResponseDto,
  type RotateInviteResponseDto,
} from "@packages/dto";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { registerSchema, ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { TokenService } from "../auth/services/token.service";
import { SessionsService } from "./sessions.service";

/**
 * Контроллер интервью-сессий (`/api/v1/sessions`).
 *
 * Все маршруты защищены глобальным `AccessTokenGuard` (Bearer + live-сессия),
 * за исключением публичных эндпоинтов с декоратором `@Public()`.
 * Модифицирующие операции доступны только владельцу сессии (HOST).
 */
@ApiTags("Sessions")
@ApiBearerAuth()
@Controller("sessions")
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    @Optional()
    private readonly tokenService?: TokenService,
  ) {}

  /**
   * Извлекает `userId` из Bearer-токена в заголовке `Authorization`, если он передан и валиден.
   */
  private extractUserIdFromRequest(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== "string") {
      return undefined;
    }
    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer" || !token) {
      return undefined;
    }
    if (!this.tokenService) {
      return undefined;
    }
    try {
      const payload = this.tokenService.verifyAccessToken(token);
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  /**
   * Создаёт новую интервью-сессию. Создатель становится владельцем
   * и участником с ролью `interviewer`.
   *
   * @param userId - UUID текущего пользователя (владельца).
   * @returns `{ sessionId, inviteToken }`.
   */
  @Post()
  @ApiOperation({ summary: "Создать новую интервью-сессию" })
  @ApiResponse({
    status: 201,
    description: "Сессия успешно создана",
    schema: registerSchema("CreateSessionResponseDto", {
      type: "object",
      properties: {
        sessionId: { type: "string", format: "uuid" },
        inviteToken: { type: "string" },
      },
      required: ["sessionId", "inviteToken"],
    }),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async createSession(
    @CurrentUser("sub") userId: string,
  ): Promise<CreateSessionResponseDto> {
    return this.sessionsService.createSession(userId);
  }

  /**
   * Создаёт новую видеовстречу (MEETING session).
   *
   * @param userId - UUID текущего пользователя (хоста).
   * @param body - Данные встречи `{ title?, description?, isPrivate?, password? }`.
   * @returns `{ sessionId, inviteToken }`.
   */
  @Post("meeting")
  @ApiOperation({ summary: "Создать новую видеовстречу" })
  @ZodBody(createMeetingSchema, "CreateMeetingDto")
  @ApiResponse({
    status: 201,
    description: "Видеовстреча успешно создана",
    schema: registerSchema("CreateMeetingResponseDto", {
      type: "object",
      properties: {
        sessionId: { type: "string", format: "uuid" },
        inviteToken: { type: "string" },
      },
      required: ["sessionId", "inviteToken"],
    }),
  })
  @ApiResponse({ status: 400, description: "Ошибка валидации входных данных" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async createMeeting(
    @CurrentUser("sub") userId: string,
    @Body(new ZodValidationPipe(createMeetingSchema)) body: CreateMeetingDto,
  ): Promise<CreateSessionResponseDto> {
    return this.sessionsService.createMeetingSession(userId, body);
  }

  /**
   * Присоединяет текущего пользователя к интервью-сессии.
   *
   * @param sessionId - UUID сессии из пути.
   * @param userId - UUID текущего пользователя (`sub`).
   * @param body - Опциональный инвайт-токен `{ inviteToken }`.
   * @returns `{ role, inviteToken }` — роль пользователя и инвайт-токен сессии.
   */
  @Post(":id/join")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Присоединиться к интервью-сессии" })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "UUID сессии",
  })
  @ZodBody(joinSessionSchema, "JoinSessionDto")
  @ApiResponse({
    status: 200,
    description: "Успешное присоединение к сессии",
    schema: registerSchema("JoinSessionResponseDto", {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: ["CANDIDATE", "INTERVIEWER", "OBSERVER"],
          description: "Роль пользователя в сессии",
        },
        inviteToken: {
          type: "string",
          description: "Инвайт-токен сессии",
        },
      },
      required: ["role", "inviteToken"],
    }),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({
    status: 403,
    description:
      "Доступ запрещен (сессия закрыта или пользователь не является участником)",
  })
  @ApiResponse({ status: 404, description: "Сессия не найдена" })
  async joinSession(
    @Param("id") sessionId: string,
    @CurrentUser("sub") userId: string,
    @Body(new ZodValidationPipe(joinSessionSchema)) body?: JoinSessionDto,
  ): Promise<JoinSessionResponseDto> {
    return this.sessionsService.joinSession(
      sessionId,
      userId,
      body?.inviteToken,
    );
  }

  /**
   * Возвращает публичные метаданные предстартового лобби встречи.
   *
   * @param sessionId - UUID сессии из пути.
   * @returns Публичные метаданные встречи.
   */
  @Public()
  @Get(":id/lobby")
  @ApiOperation({
    summary: "Получить публичные метаданные предстартового лобби встречи",
  })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "UUID сессии",
  })
  @ApiResponse({
    status: 200,
    description: "Метаданные лобби встречи",
    schema: registerSchema("MeetingLobbyResponseDto", {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        title: { type: "string" },
        description: { type: "string", nullable: true },
        isPrivate: { type: "boolean" },
        isPasswordRequired: { type: "boolean" },
        hostName: { type: "string" },
        hostAvatar: { type: "string", nullable: true },
        status: {
          type: "string",
          enum: ["CREATED", "ACTIVE", "CLOSED"],
        },
        participantCount: { type: "integer" },
      },
      required: [
        "id",
        "title",
        "isPrivate",
        "isPasswordRequired",
        "hostName",
        "status",
        "participantCount",
      ],
    }),
  })
  @ApiResponse({ status: 404, description: "Сессия не найдена" })
  async getMeetingLobby(
    @Param("id") sessionId: string,
  ): Promise<MeetingLobbyResponseDto> {
    return this.sessionsService.getMeetingLobby(sessionId);
  }

  /**
   * Подключает участника к видеовстрече (гость или авторизованный пользователь).
   *
   * @param sessionId - UUID сессии из пути.
   * @param clientIp - IP-адрес клиента для rate limiting.
   * @param req - HTTP-запрос для опционального извлечения токена авторизованного пользователя.
   * @param body - Данные для входа `{ guestName?, password?, inviteToken? }`.
   * @returns Данные подключения и LiveKit media token.
   */
  @Public()
  @Post(":id/join-meeting")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Присоединиться к видеовстрече (гость или авторизованный пользователь)",
  })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "UUID сессии",
  })
  @ZodBody(joinMeetingSchema, "JoinMeetingDto")
  @ApiResponse({
    status: 200,
    description: "Успешное присоединение к видеовстрече",
    schema: registerSchema("JoinMeetingResponseDto", {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: ["HOST", "PARTICIPANT", "CANDIDATE", "INTERVIEWER", "OBSERVER"],
        },
        inviteToken: { type: "string" },
        mediaToken: { type: "string" },
        serverUrl: { type: "string" },
        roomName: { type: "string" },
        participantId: { type: "string" },
        displayName: { type: "string" },
      },
      required: [
        "role",
        "mediaToken",
        "serverUrl",
        "roomName",
        "participantId",
        "displayName",
      ],
    }),
  })
  @ApiResponse({ status: 400, description: "Ошибка валидации входных данных" })
  @ApiResponse({
    status: 403,
    description: "Сессия закрыта, неверный пароль или комната заполнена",
  })
  @ApiResponse({ status: 404, description: "Сессия не найдена" })
  @ApiResponse({
    status: 429,
    description: "Превышен лимит попыток ввода пароля",
  })
  async joinMeeting(
    @Param("id") sessionId: string,
    @Ip() clientIp: string,
    @Req() req: Request,
    @Body(new ZodValidationPipe(joinMeetingSchema)) body?: JoinMeetingDto,
  ): Promise<JoinMeetingResponseDto> {
    const userId = this.extractUserIdFromRequest(req);
    return this.sessionsService.joinMeeting(sessionId, userId, body, clientIp);
  }

  /**
   * Завершает видеовстречу для всех участников (только HOST).
   *
   * @param sessionId - UUID сессии из пути.
   * @param userId - UUID хоста встречи.
   */
  @Post(":id/end")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Завершить видеовстречу для всех участников (только HOST)",
  })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "UUID сессии",
  })
  @ApiResponse({ status: 204, description: "Встреча успешно завершена" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Доступ запрещен (только HOST)" })
  @ApiResponse({ status: 404, description: "Сессия не найдена" })
  async endMeeting(
    @Param("id") sessionId: string,
    @CurrentUser("sub") userId: string,
  ): Promise<void> {
    await this.sessionsService.endMeeting(sessionId, userId);
  }

  /**
   * Добавляет участника в сессию (только владелец).
   *
   * @param sessionId - UUID сессии из пути.
   * @param body - Валидированные `{ userId, role }`.
   * @param ownerId - UUID текущего пользователя.
   */
  @Post(":id/participants")
  @ApiOperation({ summary: "Добавить участника в сессию" })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "UUID сессии",
  })
  @ZodBody(addParticipantSchema, "AddParticipantDto")
  @ApiResponse({ status: 201, description: "Участник успешно добавлен" })
  @ApiResponse({ status: 400, description: "Ошибка валидации входных данных" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Доступ запрещен (не владелец)" })
  @ApiResponse({ status: 404, description: "Сессия не найдена" })
  async addParticipant(
    @Param("id") sessionId: string,
    @Body(new ZodValidationPipe(addParticipantSchema)) body: AddParticipantDto,
    @CurrentUser("sub") ownerId: string,
  ): Promise<void> {
    await this.sessionsService.addParticipant(
      sessionId,
      body.userId,
      body.role as InterviewParticipantRole,
      ownerId,
    );
  }

  /**
   * Удаляет участника из сессии (только владелец).
   *
   * @param sessionId - UUID сессии из пути.
   * @param userId - UUID удаляемого участника.
   * @param ownerId - UUID текущего пользователя.
   */
  @Delete(":id/participants/:userId")
  @ApiOperation({ summary: "Удалить участника из сессии" })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "UUID сессии",
  })
  @ApiParam({
    name: "userId",
    type: "string",
    format: "uuid",
    description: "UUID удаляемого участника",
  })
  @ApiResponse({ status: 200, description: "Участник успешно удален" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Доступ запрещен (не владелец)" })
  @ApiResponse({ status: 404, description: "Сессия или участник не найдены" })
  async removeParticipant(
    @Param("id") sessionId: string,
    @Param("userId") userId: string,
    @CurrentUser("sub") ownerId: string,
  ): Promise<void> {
    await this.sessionsService.removeParticipant(sessionId, userId, ownerId);
  }

  /**
   * Закрывает сессию (только владелец). Публикует room-scoped ревокации,
   * которые обрывают WS участников этой сессии (1008).
   *
   * @param sessionId - UUID сессии из пути.
   * @param ownerId - UUID текущего пользователя.
   */
  @Post(":id/close")
  @ApiOperation({ summary: "Закрыть интервью-сессию" })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "UUID сессии",
  })
  @ApiResponse({ status: 201, description: "Сессия успешно закрыта" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Доступ запрещен (не владелец)" })
  @ApiResponse({ status: 404, description: "Сессия не найдена" })
  async closeSession(
    @Param("id") sessionId: string,
    @CurrentUser("sub") ownerId: string,
  ): Promise<void> {
    await this.sessionsService.closeSession(sessionId, ownerId);
  }

  /**
   * Ротирует инвайт-токен сессии (только владелец).
   * Старый токен аннулируется, возвращается новый `{ inviteToken }`.
   *
   * @param sessionId - UUID сессии из пути.
   * @param ownerId - UUID текущего пользователя.
   */
  @Post(":id/rotate-invite")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Ротировать инвайт-токен сессии" })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "UUID сессии",
  })
  @ApiResponse({
    status: 200,
    description: "Инвайт-токен успешно ротирован",
    schema: registerSchema("RotateInviteResponseDto", {
      type: "object",
      properties: {
        inviteToken: {
          type: "string",
          description: "Новый инвайт-токен сессии",
        },
      },
      required: ["inviteToken"],
    }),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен (не владелец или сессия закрыта)",
  })
  @ApiResponse({ status: 404, description: "Сессия не найдена" })
  async rotateInviteToken(
    @Param("id") sessionId: string,
    @CurrentUser("sub") ownerId: string,
  ): Promise<RotateInviteResponseDto> {
    return this.sessionsService.rotateInviteToken(sessionId, ownerId);
  }
}
