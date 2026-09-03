/**
 * @packages/api — публичный API-клиент и TanStack Query v5 хуки
 *
 * Предоставляет:
 * 1. HTTP Transport & Dependency Inversion:
 *    - `setHttpTransport` для внедрения runtime-транспорта (например, baseFetch в apps/web)
 *    - `customInstance` — Orval-мутатор
 *    - типы `RequestConfig`, `HttpTransport`
 * 2. Generated Models (DTO):
 *    - `UserProfileDto`, `LoginDto`, `RegisterDto`, `AddParticipantDto`, `TicketDto` и др.
 * 3. Generated API functions & TanStack Query v5 hooks:
 *    - `authController*`, `useAuthController*`
 *    - `healthController*`, `useHealthController*`
 *    - `profileController*`, `useProfileController*`
 *    - `realtimeController*`, `useRealtimeController*`
 *    - `sessionsController*`, `useSessionsController*`
 *    - `usersController*`, `useUsersController*`
 */

// Generated API functions & TanStack Query v5 hooks
export * from "./generated/endpoints/auth/auth";
export * from "./generated/endpoints/health/health";
export * from "./generated/endpoints/profile/profile";
export * from "./generated/endpoints/realtime/realtime";
export * from "./generated/endpoints/sessions/sessions";
export * from "./generated/endpoints/users/users";
// Generated DTO models
export * from "./generated/model";
// HTTP Transport & Dependency Inversion
export {
  customInstance,
  defaultFetchTransport,
  getHttpTransport,
  type HttpTransport,
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
} from "./transport";
