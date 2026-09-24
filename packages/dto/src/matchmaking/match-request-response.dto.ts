import type { MatchRequestStatus } from "../showcase/showcase.enums";
import type {
  PublicUserCardDto,
  ShowcaseCardResponseDto,
} from "../showcase/showcase-response.dto";

/**
 * [Response] Ответ сервера с полными данными заявки на собеседование.
 *
 * Примечание по названию:
 * `MatchRequest` — это название бизнес-сущности («Заявка на собеседование»),
 * а не технический HTTP-запрос. `ResponseDto` указывает, что это ответ сервера.
 *
 * Включает сразу данные самой заявки, публичные визитки обоих участников (sender/receiver)
 * и связанные карточки витрины (targetCard/senderCard). Это позволяет фронтенду отобразить
 * карточку отклика в интерфейсе за один сетевой запрос без водопада дополнительных запросов.
 */
export interface MatchRequestResponseDto {
  id: string;

  senderId: string;
  receiverId: string;
  sender: PublicUserCardDto;
  receiver: PublicUserCardDto;

  targetCard: ShowcaseCardResponseDto; // Карточка витрины, на которую отправлен отклик
  senderCard: ShowcaseCardResponseDto | null; // Прикреплённая карточка автора отклика (если указана)

  // Статус заявки и сообщения участников
  status: MatchRequestStatus;
  message: string | null; // Сопроводительное сообщение инициатора
  preferredTopic: string | null; // Желаемая тема мок-интервью
  rejectReason: string | null; // Причина отклонения (заполняется при REJECTED)

  // Временные метки
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt: Date | string; // Срок жизни заявки (72 часа с момента создания)
}

/**
 * [Response] Счётчик входящих заявок в статусе PENDING (ожидают ответа).
 * Легковесный ответ для бейджа в шапке сайта и колокольчика уведомлений.
 */
export interface UnreadMatchRequestsCountDto {
  pendingCount: number;
}
