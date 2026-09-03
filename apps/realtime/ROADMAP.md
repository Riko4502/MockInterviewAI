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
* **Аутентификация по тикету / Bearer / Cookie:**
  * Приоритет извлечения кредов: одноразовый тикет в `Sec-WebSocket-Protocol: ["realtime", <ticket>]` → `Authorization: Bearer` → HTTP-only Cookie (`access_token` / `JWT_ACCESS_COOKIE_NAME`).
  * Access-фолбэк (Bearer/Cookie) работает только при `REALTIME_ALLOW_ACCESS_FALLBACK=true`.
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

### 1.4. Глобальный поток уведомлений (Server-Sent Events)
Реализован этап 1 плана внедрения из [SSE_SPEC.md](./SSE_SPEC.md) — ядро SSE в пакете `internal/sse`.
* **Эндпоинт `GET /sse/notifications`:** однонаправленный поток персональных и общесистемных уведомлений с временем жизни, равным сессии логина пользователя.
* **Гарантия at-least-once:** при переподключении клиент присылает `Last-Event-ID`, сервер отдаёт пропущенное из `user:{userId}:notifications` через `XRANGE` (фаза Replay), затем переходит в блокирующий `XREAD BLOCK` (фаза Live Streaming). Значение заголовка валидируется как Redis Stream ID перед подстановкой в запрос.
* **Мультиплексирование вкладок:** на `userId` приходится ровно одна горутина вычитки стрима; событие расходится по всем локальным вкладкам через неблокирующие каналы. Дубли между Replay и живой подпиской отсекаются сравнением Stream ID.
* **Защита от медленных клиентов:** кольцевой буфер на 128 событий, неблокирующая запись с метрикой `realtime_sse_dropped_messages_total`; при длительном переполнении соединение принудительно закрывается, и клиент добирает пропущенное после переподключения.
* **Лимиты:** 5 соединений на пользователя (кластерный счётчик `user:{userId}:sse_count` с TTL) и 20 соединений с одного IP на ноду; превышение — `429 Too Many Requests` с `Retry-After`.
* **Безопасность:** токен только из `HttpOnly` cookie или `Authorization: Bearer`, передача в query string отклоняется с кодом 400; отзыв авторизации через `auth:revocations` шлёт финальное событие `auth.revoked` и разрывает все потоки пользователя.
* **Стабильность долгоживущего потока:** heartbeat-комментарий `: ping <ts>` каждые 15 секунд, заголовок `X-Accel-Buffering: no` и снятие `ReadTimeout` / `WriteTimeout` HTTP-сервера с соединения через `http.ResponseController`.
* **Наблюдаемость:** метрики SSE из раздела 8 спецификации отдаются эндпоинтом `GET /metrics` в формате Prometheus, сводка — в `GET /readyz`.

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

### 3.4. Интеграция SSE-уведомлений в остальные сервисы
Ядро SSE в `apps/realtime` реализовано (см. раздел 1.4). Осталась работа на стороне продюсеров и клиента — этапы 2–4 плана внедрения из [SSE_SPEC.md](./SSE_SPEC.md):
* **Продюсеры (`apps/api`, `apps/code-runner`, AI worker):** сервис `NotificationPublisher` в NestJS, публикующий события через `XADD user:{userId}:notifications MAXLEN ~ 100`, и триггеры на создание сессии, инвайт, окончание прогона тестов и генерацию AI-отчета.
* **Клиент (`apps/web`):** глобальный `NotificationProvider` на `@microsoft/fetch-event-source`, обработка `visibilitychange` / `online` в мобильных браузерах, тосты (`sonner`) и бейдж непрочитанных.
* **Инфраструктура:** директивы `http2`, `proxy_buffering off` и `proxy_read_timeout 3600s` в Nginx, дашборд Grafana и алерт на рост `realtime_sse_dropped_messages_total`.
* **Долгосрочная история:** сохранение уведомлений в PostgreSQL сервисом `apps/api` для шторки «Все уведомления» (Redis Streams остаётся только транспортным буфером).



