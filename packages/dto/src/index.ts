/**
 * Публичный API пакета `@packages/dto`.
 *
 * Экспортирует DTO-схемы и утилиты валидации (§5–8, §58 SPEC.md):
 * схема регистрации, схема входа, password policy, нормализация email.
 */

export * from "./admin";
export {
  type ChangePasswordDto,
  changePasswordSchema,
} from "./auth/change-password.dto";
export { normalizeEmail } from "./auth/email";
export {
  type ForgotPasswordDto,
  forgotPasswordSchema,
} from "./auth/forgot-password.dto";
export { type LoginDto, loginSchema } from "./auth/login.dto";
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./auth/password-policy";
export { type RegisterDto, registerSchema } from "./auth/register.dto";
export {
  RESET_PASSWORD_ERROR_CODES,
  type ResetPasswordDto,
  type ResetPasswordErrorCode,
  type ResetPasswordErrorPayload,
  resetPasswordSchema,
} from "./auth/reset-password.dto";
export type {
  MatchRequestResponseDto,
  UnreadMatchRequestsCountDto,
} from "./matchmaking/match-request-response.dto";
// Matchmaking
export {
  type CreateMatchRequestDto,
  createMatchRequestSchema,
  type MatchRequestQueryDto,
  matchRequestQuerySchema,
  type RejectMatchRequestDto,
  rejectMatchRequestSchema,
} from "./matchmaking/matchmaking.dto";
export {
  type NotificationActionResponseDto,
  type NotificationDto,
  type NotificationsListDto,
  notificationActionResponseSchema,
  notificationSchema,
  notificationsListSchema,
  notificationTypeSchema,
  type UnreadNotificationsCountDto,
  unreadNotificationsCountSchema,
} from "./notifications/notification.dto";
export {
  GIT_URL_REGEX,
  normalizeTelegramUsername,
  TELEGRAM_USERNAME_REGEX,
  type UpdateProfileDto,
  USERNAME_REGEX,
  updateProfileSchema,
} from "./profile/update-profile.dto";
export {
  type PublicUserProfileDto,
  publicUserProfileSchema,
  type UserProfileDto,
  userProfileSchema,
} from "./profile/user-profile.dto";
export {
  type MediaTokenRequestDto,
  type MediaTokenResponseDto,
  mediaTokenRequestSchema,
} from "./realtime/media-token.dto";
export { type TicketDto, ticketSchema } from "./realtime/ticket.dto";
export type {
  AISuggestionPayload,
  AnyWebSocketEnvelope,
  BaseWebSocketEnvelope,
  ChatMessagePayload,
  CodeUpdatePayload,
  CursorPayload,
  MediaRecordingPayload,
  MediaSpeakerPayload,
  MediaStatePayload,
  ParticipantInfo,
  ParticipantRole,
  PresenceJoinPayload,
  PresenceLeavePayload,
  RoomSyncPayload,
  SupportedLanguage,
  SystemAckPayload,
  SystemErrorPayload,
} from "./realtime/websocket-events.dto";
export {
  type CreateSessionResponseDto,
  createSessionResponseSchema,
  type JoinSessionDto,
  type JoinSessionResponseDto,
  joinSessionResponseSchema,
  joinSessionSchema,
  type RotateInviteResponseDto,
  rotateInviteResponseSchema,
} from "./sessions/join-session.dto";
export {
  type AddParticipantDto,
  addParticipantSchema,
  type InterviewParticipantRole,
  interviewParticipantRoleSchema,
} from "./sessions/participant.dto";
export {
  type CreateShowcaseCardDto,
  createShowcaseCardSchema,
  type UpdateShowcaseCardDto,
  type UpdateShowcaseCardStatusDto,
  updateShowcaseCardSchema,
  updateShowcaseCardStatusSchema,
} from "./showcase/manage-showcase-card.dto";
export {
  normalizeSkill,
  type ParsedSearchQuery,
  parseSearchQuery,
  sanitizeSearchTerm,
  stripHtmlTags,
} from "./showcase/search-parser";
// Showcase
export {
  type ExperienceLevel,
  experienceLevelEnum,
  type InterviewLanguage,
  interviewLanguageEnum,
  type MatchRequestStatus,
  matchRequestStatusEnum,
  type ShowcaseCardStatus,
  type ShowcaseSortBy,
  type Specialization,
  showcaseCardStatusEnum,
  showcaseSortByEnum,
  specializationEnum,
} from "./showcase/showcase.enums";
export {
  type ShowcaseQueryDto,
  showcaseQuerySchema,
} from "./showcase/showcase-query.dto";
export type {
  PaginatedResponseDto,
  PublicUserCardDto,
  ShowcaseCardResponseDto,
  ShowcaseCardStatsDto,
} from "./showcase/showcase-response.dto";
