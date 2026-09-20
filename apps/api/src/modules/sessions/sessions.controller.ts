import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
  type AddParticipantDto,
  addParticipantSchema,
  type CreateSessionResponseDto,
  type InterviewParticipantRole,
  type JoinSessionDto,
  type JoinSessionResponseDto,
  joinSessionSchema,
  type RotateInviteResponseDto,
} from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { registerSchema, ZodBody } from "../../common/openapi/zod-openapi";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SessionsService } from "./sessions.service";

/**
 * Контроллер интервью-сессий (`/api/v1/sessions`).
 *
 * Все маршруты защищены глобальным `AccessTokenGuard` (Bearer + live-сессия).
 * Модифицирующие операции (участники, close) доступны только владельцу сессии.
 */
@ApiTags("Sessions")
@ApiBearerAuth()
@Controller("sessions")
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

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
    await this.assertOwner(sessionId, ownerId);
    await this.sessionsService.addParticipant(
      sessionId,
      body.userId,
      body.role as InterviewParticipantRole,
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
    await this.assertOwner(sessionId, ownerId);
    await this.sessionsService.removeParticipant(sessionId, userId);
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
    await this.assertOwner(sessionId, ownerId);
    await this.sessionsService.closeSession(sessionId);
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
    await this.assertOwner(sessionId, ownerId);
    return this.sessionsService.rotateInviteToken(sessionId);
  }

  /**
   * Проверяет, что текущий пользователь является владельцем сессии.
   * Несуществующая сессия → 404 (выбрасывается в `getOwner`),
   * не владелец → 403.
   */
  private async assertOwner(sessionId: string, ownerId: string): Promise<void> {
    const actualOwner = await this.sessionsService.getOwner(sessionId);
    if (actualOwner !== ownerId) {
      throw new ForbiddenException(
        "Only the session owner can perform this action",
      );
    }
  }
}
