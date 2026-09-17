import type {
  ExperienceLevel,
  InterviewLanguage,
  ShowcaseCardStatus,
  Specialization,
} from "./showcase.enums";

/**
 * [Response] Публичная визитка автора карточки.
 * Содержит только безопасные данные пользователя (без email и хеша пароля).
 * Поле telegramUsername заполняется только после взаимного принятия заявки (ACCEPTED).
 */
export interface PublicUserCardDto {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  telegramUsername: string | null;
  gitUrl: string | null;
}

/**
 * [Response] Статистика заявок для автора карточки.
 * Возвращается только владельцу карточки в личном кабинете (GET /showcase/my).
 */
export interface ShowcaseCardStatsDto {
  pendingRequestsCount: number;
  acceptedRequestsCount: number;
}

/**
 * [Response] Полные данные карточки участника витрины.
 * Отдаётся сервером клиенту при создании, редактировании или просмотре анкеты на витрине.
 */
export interface ShowcaseCardResponseDto {
  id: string;
  userId: string;
  user: PublicUserCardDto;
  title: string | null;
  specialization: Specialization;
  level: ExperienceLevel;
  language: InterviewLanguage;
  skills: string[];
  bio: string | null;
  scheduleInfo: string | null;
  isUrgent: boolean;
  status: ShowcaseCardStatus;
  autoRenew: boolean;
  bumpedAt: Date | string;
  expiresAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;

  /** Дополнительная статистика (заполняется только для автора в GET /showcase/my) */
  stats?: ShowcaseCardStatsDto;
}

/**
 * [Response] Универсальная обёртка пагинированного ответа API.
 * Содержит массив данных `data` и мета-информацию `meta` для постраничной навигации.
 *
 * @example PaginatedResponseDto<ShowcaseCardResponseDto>
 */
export interface PaginatedResponseDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
