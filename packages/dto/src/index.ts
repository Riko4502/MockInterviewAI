/**
 * Публичный API пакета `@packages/dto`.
 *
 * Экспортирует DTO-схемы и утилиты валидации (§5–8, §58 SPEC.md):
 * схема регистрации, схема входа, password policy, нормализация email.
 */

export { normalizeEmail } from "./auth/email";
export { type LoginDto, loginSchema } from "./auth/login.dto";
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./auth/password-policy";
export { type RegisterDto, registerSchema } from "./auth/register.dto";
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
export { type TicketDto, ticketSchema } from "./realtime/ticket.dto";
export {
  type AddParticipantDto,
  addParticipantSchema,
  type InterviewParticipantRole,
  interviewParticipantRoleSchema,
} from "./sessions/participant.dto";
