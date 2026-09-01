# Redis: Сессии, Блэклисты и Pub/Sub

**Redis 7** используется в качестве высокопроизводительного in-memory хранилища для сессий, черных списков токенов, ограничения частоты запросов (rate limiting) и обмена сообщениями между сервисами.

---

## 1. Сценарии использования Redis

| Сценарий | Сервис | Описание | Формат ключа | TTL |
| :--- | :--- | :--- | :--- | :--- |
| **Auth Sessions** | `apps/api` | Аутентификационные сессии: наличие ключа = сессия активна (live-проверка `EXISTS` для гуардов); `logout/revoke` = удаление ключа | `auth:session:{sid}` (JSON: `userId`, `refreshTokenHash`, `tokenFamilyId`, `lastUsedAt`) | Срок жизни refresh-токена |
| **"Выйти со всех устройств"** | `apps/api` | Отзыв всех сессий пользователя: SCAN `auth:session:*` + фильтр по `userId` и удаление ключей | `auth:session:{sid}` (перебор) | — |
| **Rate Limiting** | `apps/api` | Защита эндпоинтов от перебора паролей и DoS атак | `throttle:{ip}:{endpoint}` | 60 секунд |
| **Pub/Sub Room Events** | `apps/realtime` | Ретрансляция событий комнат между разными инстансами WebSocket | канал `session:{sessionId}:events` | — |
| **Access Fallback (realtime)** | `apps/realtime` | Проверка отзыва access-токена `IsTokenRevoked` только при access-фолбэке (включен `REALTIME_ALLOW_ACCESS_FALLBACK`). В `apps/api` чёрный список не пишется и не проверяется — ревокация через удаление `auth:session:{sid}` | `blacklist:token:{jti}` (только чтение) | Остаток срока жизни токена |
| **Session Mirror** | `apps/api` (записывает), `apps/realtime` (продлевает TTL) | Зеркало активной сессии: `:active` — маркер живости, `:members` — участники; `hset`/`hget`/`hdel`. Используется для live-проверки токенов и при входе по тикету | `session:{id}:active` / `session:{id}:members` | TTL (`SESSION_MIRROR_TTL_SECONDS`), продлевается realtime при аутентификации участника |
| **Auth Revocations Pub/Sub** | `apps/api` (публикует), `apps/realtime` (слушает) | Мгновенный отзыв авторизации: logout/bane — `EvictUser` (все комнаты); close-сессии — `EvictFromRoom` (одна комната); сообщение `{instanceId, data: userId, sessionId?}` | канал `auth:revocations` | — |

---

## 2. Безопасность и хранение токенов

* **Хеширование перед сохранением:** В Redis **никогда не сохраняются сырые refresh токены**. HMAC-SHA256 хеш (`REFRESH_TOKEN_HASH_SECRET`) хранится внутри `auth:session:{sid}` как `refreshTokenHash` и используется при ротации/смене refresh-токена.
* **Автоматический TTL:** Каждый ключ в Redis обязан иметь время жизни (`EXPIRE`), чтобы память не утекала со временем.

---

## 3. Клиент Redis в NestJS (`ioredis`)

Подключение реализуется через библиотеку `ioredis` с автоматическим reconnect и health-check проверками:

```typescript
// Пример live-проверки активной auth-сессии (гуарды, §16):
const sessionActive = await this.redisClient.exists(`auth:session:${sid}`);
if (!sessionActive) {
  throw new UnauthorizedException("Session has been revoked");
}
```
