import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
  type InterviewParticipantRole,
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
   * @returns `{ sessionId }`.
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
      },
      required: ["sessionId"],
    }),
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async createSession(
    @CurrentUser("sub") userId: string,
  ): Promise<{ sessionId: string }> {
    return this.sessionsService.createSession(userId);
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
