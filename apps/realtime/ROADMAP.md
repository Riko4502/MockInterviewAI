# Realtime Service: Архитектура, Реализованный функционал и Roadmap

Документ описывает текущее состояние Go WebSocket сервиса `apps/realtime`, архитектурные решения, уже реализованный функционал, известные нюансы и оставшиеся задачи.

---

## 1. Что уже реализовано (Completed)

### 1.1. WebSocket Ядро и Протокол
* **Движок WebSocket:** Построен на базе `github.com/coder/websocket` и маршрутизатора `github.com/go-chi/chi/v5` с минимальным оверхедом памяти и поддержкой context-отмены.
* **Строго типизированный протокол (Envelope):**
  * Все сообщения упакованы в структуру `WebSocketEnvelope<T>` с полями `type`, `version`, `sessionId`, `requestId`, `timestamp`, `payload`.
  * Типы событий: `room.sync`, `presence.join/leave`, `code.update`, `cursor.move`, `chat.message`, `media.*`, `ai.suggestion`, `system.*`.
* **Политика «1 пользователь = 1 соединение в сессии»:** При открытии сессии в новой вкладке старое соединение пользователя корректно вытесняется (`StatusGoingAway: displaced by new connection`).

### 1.2. Безопасность и Валидация
* **Аутентификация по Cookie / Bearer:**
  * Токены считываются из защищенных HTTP-only Cookie (`access_token` / `JWT_ACCESS_COOKIE_NAME`) или заголовка `Authorization: Bearer`.
  * Защита от спуфинга: `userId` и `role` в событиях подставляются строго сервером из проверенного JWT и Redis.
* **Защита от CSWSH (Cross-Site WebSocket Hijacking):**
  * Обязательная проверка `ALLOWED_ORIGINS`. В продакшене wildcard `*` строго запрещён.
* **Rate Limiting и защита от флуда:**
  * Токен-бакет лимитер на клиенте: 60 msg/s (со всплеском до 120 msg/s).
  * Лимиты на максимальное количество соединений на сервер (`MAX_CONNECTIONS`) и в одной комнате (`MAX_ROOM_CLIENTS`).

### 1.3. Распределённое состояние (Redis Pub/Sub & Persistence)
* **Персистентность кода сессии (Code State Persistence):**
  * При событии `code.update` код сохраняется в памяти и персистится в Redis (`session:{sessionId}:code` с TTL 24 часа).
  * При старте комнаты или входе нового участника код автоматически восстанавливается из Redis и отправляется в `room.sync`.
* **Горизонтальное масштабирование (Multi-instance Pub/Sub):**
  * Межсерверная рассылка событий через Redis канал `session:{sessionId}:events` с фильтрацией эхо-сообщений по `instanceId`.
* **Мгновенная инвалидация сессий (Token Revocation & Eviction):**
  * Фоновая подписка на Redis-канал `auth:revocations`. При отзыве токена или блокировке пользователя сокеты на всех репликах мгновенно принудительно закрываются (`StatusPolicyViolation: user authentication revoked`).
* **Безопасный жизненный цикл комнат (No-deadlock Reaper):**
  * Выгрузка неактивных комнат управляется таймером простоя `idleTimer` (60 сек) без блокировок и взаимных дедлоков `Hub.mu`.

---

## 2. Текущие особенности и нюансы (Known Limitations)
1. **Текстовый дифференциал кода (Operational Transformation / CRDT):**
   * Сейчас `code.update` передаёт полное содержимое файла (снапшот до 500 KB) с инкрементной версией. Для большинства сценариев парного интервью этого достаточно, но для одновременного быстрого тайпинга двух людей в одну строку в будущем может потребоваться CRDT (например, Yjs через WebSocket).

---

## 3. Что осталось сделать (Roadmap / To Do)

### 3.1. Генерация AI-подсказок (AI Suggestion Engine)
* **Интеграция OpenAI SDK (`github.com/sashabaranov/go-openai`):**
  * Инициализация клиента OpenAI по ключу `OPENAI_API_KEY` (модель `gpt-4o` / `gpt-4o-mini`).
  * Обработка системных промптов: анализ написанного кандидатом кода, расчёт алгоритмической сложности (Big-O), генерация наводящих подсказок интервьюеру (`category: "hint" | "follow_up_question" | "code_complexity_alert"`).
  * Фоновый воркер: генерация подсказок по запросу интервьюера (`ai.request_hint`) или при долгой паузе кандидата (Inactivity Trigger).

### 3.2. LiveKit Egress & Recording Trigger
* Добавление триггера запуска/остановки облачной записи интервью через LiveKit Server API с последующей отправкой ссылки на запись в сервис аналитики.

### 3.3. Мониторинг и Observability (Prometheus + Grafana)
* **Экспорт метрик Prometheus в Realtime сервисе:**
  * Реализация эндпоинта `/metrics` (на базе `github.com/prometheus/client_golang`).
  * Сбор ключевых бизнес- и системных метрик:
    * `realtime_active_connections_total` — текущее количество активных WebSocket соединений.
    * `realtime_active_rooms_total` — количество запущенных комнат сессий.
    * `realtime_messages_processed_total` (counter по типам событий: `code.update`, `cursor.move`, `chat.message`).
    * `realtime_redis_latency_seconds` (histogram времени публикации и доставки через Pub/Sub).
    * `realtime_ws_errors_total` (counter ошибок протокола и переполнения буфера).
* **Стек Prometheus & Grafana в Docker Compose:**
  * Добавление сервисов `prometheus` и `grafana` в `docker-compose.prod.yml`.
  * Настройка таргетов скрейпинга (`prometheus.yml`) для сервисов `realtime`, `api` и `redis-exporter`.
  * Готовый дашборд Grafana с графиками онлайна комнат, нагрузки на память, RPS сообщений и задержек синхронизации кода.

### 3.4. Сервис real-time уведомлений на базе Server-Sent Events (SSE)
* **Спецификация и архитектура:** Подробно описана в [SSE_SPEC.md](./SSE_SPEC.md).
* **Эндпоинт:** `GET /sse/notifications` — глобальный поток персональных и общесистемных уведомлений пользователя.
* **События:**
  * `notification.new` — персональные алерты и уведомления для тостов / центра уведомлений.
  * `session.invited` — мгновенные инвайты в активную комнату собеседования.
  * `code_runner.completed` — статус асинхронного выполнения тестов кандидата.
  * `ai.report_ready` — уведомление о готовности итогового AI-отчета интервью.
  * `system.broadcast` — оповещения о техработах.
* **Интеграция:** Брокер уведомлений `notification.Broker` с динамической подпиской на каналы Redis `user:{userId}:notifications` и `notifications:broadcast`, поддержка нескольких вкладок одного пользователя (multi-tab) и авто-восстановление соединения.



