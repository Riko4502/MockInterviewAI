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
export {
  type TelegramAuthDto,
  type TelegramCompleteDto,
  type TelegramLinkDto,
  telegramAuthSchema,
  telegramCompleteSchema,
  telegramLinkSchema,
} from "./auth/telegram.dto";
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
  type DeviceSettingsDto,
  deviceSettingsSchema,
  type MediaSettingsDto,
  mediaSettingsSchema,
  type UpdateDeviceSettingsDto,
  type UpdateMediaSettingsDto,
  updateDeviceSettingsSchema,
  updateMediaSettingsSchema,
} from "./profile/media-settings.dto";
export {
  GIT_URL_REGEX,
  type Locale,
  localeLabels,
  locales,
  normalizeTelegramUsername,
  TELEGRAM_USERNAME_REGEX,
  THEME_MODES,
  type ThemeMode,
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
  RoomErrorPayload,
  RoomSyncPayload,
  SupportedLanguage,
  SystemAckPayload,
  SystemErrorPayload,
} from "./realtime/websocket-events.dto";
export {
  BASE64_REGEX,
  baseWebSocketEnvelopeSchema,
  type RoomErrorEnvelope,
  roomErrorEnvelopeSchema,
  roomErrorPayloadSchema,
  type TaskSwitchEnvelope,
  type TaskSwitchedEnvelope,
  type TaskSwitchedPayload,
  type TaskSwitchPayload,
  taskSwitchEnvelopeSchema,
  taskSwitchedEnvelopeSchema,
  taskSwitchedPayloadSchema,
  taskSwitchPayloadSchema,
  YJS_MAX_BASE64_LENGTH,
  YJS_SNAPSHOT_MAX_BASE64_LENGTH,
  type YjsAckEnvelope,
  type YjsAckPayload,
  type YjsAwarenessEnvelope,
  type YjsAwarenessPayload,
  type YjsInitEnvelope,
  type YjsInitPayload,
  type YjsSnapshotEnvelope,
  type YjsSnapshotPayload,
  type YjsUpdateEnvelope,
  type YjsUpdatePayload,
  yjsAckEnvelopeSchema,
  yjsAckPayloadSchema,
  yjsAwarenessEnvelopeSchema,
  yjsAwarenessPayloadSchema,
  yjsDataSchema,
  yjsInitEnvelopeSchema,
  yjsInitPayloadSchema,
  yjsSnapshotDataSchema,
  yjsSnapshotEnvelopeSchema,
  yjsSnapshotPayloadSchema,
  yjsTaskKeySchema,
  yjsUpdateEnvelopeSchema,
  yjsUpdatePayloadSchema,
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
export {
  type TelegramInterviewDto,
  type TelegramInterviewsListDto,
  type TelegramInterviewsQuery,
  telegramInterviewSchema,
  telegramInterviewsListSchema,
  telegramInterviewsQuerySchema,
} from "./telegram/interviews.dto";
export {
  type LinkRequest,
  type LinkTokenResponse,
  linkRequestSchema,
  linkTokenResponseSchema,
} from "./telegram/link.dto";
export {
  type TelegramPreferencesPatch,
  telegramPreferencesPatchSchema,
} from "./telegram/preferences.dto";
export {
  type TelegramProfileQuery,
  type TelegramUserProfileDto,
  telegramProfileQuerySchema,
  telegramUserProfileSchema,
} from "./telegram/profile.dto";
export {
  type UnlinkRequest,
  type UnlinkResponse,
  unlinkRequestSchema,
  unlinkResponseSchema,
} from "./telegram/unlink.dto";
