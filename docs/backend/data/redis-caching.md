# Redis: Сессии, Блэклисты и Pub/Sub

**Redis 7** используется в качестве высокопроизводительного in-memory хранилища для сессий, черных списков токенов, ограничения частоты запросов (rate limiting) и обмена сообщениями между сервисами.

---

## 1. Сценарии использования Redis

| Сценарий | Сервис | Описание | Формат ключа | TTL |
| :--- | :--- | :--- | :--- | :--- |
| **Refresh Token Blacklist** | `apps/api` | Инвалидация refresh токенов при logout или смене пароля | `blacklist:refresh:{tokenHash}` | 7 дней (срок жизни токена) |
| **User Active Sessions** | `apps/api` | Хранение активных сессий пользователя для функции "выйти со всех устройств" | `sessions:{userId}` (Set) | 7 дней |
| **Rate Limiting** | `apps/api` | Защита эндпоинтов от перебора паролей и DoS атак | `throttle:{ip}:{endpoint}` | 60 секунд |
| **Pub/Sub Room Events** | `apps/realtime` | Ретрансляция событий комнат между разными инстансами WebSocket | канал `room:{sessionId}` | — |

---

## 2. Безопасность и хранение токенов

* **Хеширование перед сохранением:** В Redis **никогда не сохраняются сырые refresh токены**. Перед помещением в блэклист или сравнением токен хэшируется через HMAC-SHA256 с использованием секретного ключа `REFRESH_TOKEN_HASH_SECRET`.
* **Автоматический TTL:** Каждый ключ в Redis обязан иметь время жизни (`EXPIRE`), чтобы память не утекала со временем.

---

## 3. Клиент Redis в NestJS (`ioredis`)

Подключение реализуется через библиотеку `ioredis` с автоматическим reconnect и health-check проверками:

```typescript
// Пример проверки нахождения токена в блэклисте:
const isBlacklisted = await this.redisClient.exists(`blacklist:refresh:${tokenHash}`);
if (isBlacklisted) {
  throw new UnauthorizedException("Session has been revoked");
}
```
