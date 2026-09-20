/**
 * Общие хелперы для Redis-ключей зеркала сессий.
 *
 * Используются `SessionsService` и `LivekitService` — анти-дрейф формата ключей.
 */

/** Ключ активности сессии: `session:{id}:active` → `"true"` / `"closed"`. */
export function sessionActiveKey(sessionId: string): string {
  return `session:${sessionId}:active`;
}

/** Ключ участников сессии (hash): `session:{id}:members` → `{userId → role}`. */
export function sessionMembersKey(sessionId: string): string {
  return `session:${sessionId}:members`;
}

/** Ключ активного инвайт-токена сессии: `session:{id}:invite` → string (random token). */
export function sessionInviteKey(sessionId: string): string {
  return `session:${sessionId}:invite`;
}
