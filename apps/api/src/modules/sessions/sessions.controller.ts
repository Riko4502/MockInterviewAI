import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
  Post,
} from "@nestjs/common";
import {
  type AddParticipantDto,
  addParticipantSchema,
  type InterviewParticipantRole,
} from "@packages/dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SessionsService } from "./sessions.service";

/**
 * Контроллер интервью-сессий (`/api/v1/sessions`).
 *
 * Все маршруты защищены глобальным `AccessTokenGuard` (Bearer + live-сессия).
 * Модифицирующие операции (участники, close) доступны только владельцу сессии.
 */
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
