# Spec: Observability Package

**Версия:** 0.4.0

## 1. Цель

Создать единый «observability-пакет» в монорепо, который концентрирует всю
конфигурацию Sentry + Prometheus + Grafana и переиспользуется всеми
сервисами:

- `apps/api` — NestJS (REST)
- `apps/realtime` — Go (WebSocket/SSE)
- `apps/web` — Next.js (основное приложение)
- `apps/landing` — Next.js (лендинг)

Пакет **не** берёт на себя исполняемую логику рантайма, а предоставляет:

- единые **пресеты конфигурации** для SDK (`@sentry/nestjs`, `@sentry/nextjs`,
  `sentry-go`);
- единые **Zod-схемы** env-переменных (валидация + типизация);
- **графаны-дашборды** (JSON) для метрик, которые импортируются при деплое.

## 2. Принципы (Constitution монорепо)

1. `packages/*` никогда не импортирует из `apps/*` (Dependency Inversion).
2. Наборный пакет (как `@packages/dto`): компилируется в CJS через `tsc`,
   т.к. `apps/api` использует `moduleResolution: "node"` и требует runtime-`js`;
   билд также копирует JSON-дашборды в `dist/` (`tsc && node scripts/copy-dashboards.mjs`).
3. Вся конфигурация отправки данных в Sentry/Prometheus управляется **через
   переменные окружения**, схемы которых задаются в этом пакете.

## 3. Выбранные решения (протокол с пользователем)

| Вопрос | Решение |
|--------|---------|
| Деплой Grafana | **Docker Compose** (добавить в `docker-compose.prod.yml`) |
| Трассировка | **Minimal** — Sentry Performance, без OTel Collector / Tempo |
| Логирование | **Errors only** — Sentry для ошибок, structured logs остаются в stdout |
| Source Maps (frontend) | **Да** — upload в Sentry при билде |
| Экспорт серверных метрик Redis | **Отдельный контейнер** `prom/redis-exporter` + job `redis` в Prometheus |
| Клиентская (in-app) инструментация Redis | **Лёгкая** — статус соединения, `PoolStats`, счётчики ошибок; без гистограмм латентности команд (берётся из exporter `commandstats`) |
| Пароль прод-Redis (`requirepass`) | **Без изменений** в рамках этого этапа — только мониторинг |
| Throttler API → Redis (`ThrottlerStorageRedis`) | **Отложено** (в открытых вопросах) |
| Sentry Datasource plugin в Grafana | **Да** — ставим для корреляции ошибок с метриками |
| Распространение dashboards | **Копировать при деплое** (CI-шаг `deploy:observability`), тома не монтировать |
| Прод-Redis `maxmemory-policy` | **Отложено** до анализа usage-паттернов (alert на эвикцию всё равно ставим) |
| Redis-auth в прод | **Отложено**; фиксация риска в `SECURITY.md` — открытый долг |

## 4. Структура

```
packages/observability/
├── package.json
├── tsconfig.json
├── SPEC.md
├── PLAN.md
├── src/
│   ├── index.ts
│   ├── sentry/
│   │   ├── index.ts         # barrel
│   │   ├── env.ts           # Zod-схема env Sentry
│   │   ├── nestjs.config.ts # пресет для @sentry/nestjs
│   │   ├── nextjs.config.ts # пресет для @sentry/nextjs (build-time)
│   │   ├── runtime.config.ts# пресет для серверного/edge рантайма
│   │   └── client.config.ts # пресет для браузерного рантайма (NEXT_PUBLIC_SENTRY_DSN)
│   └── prometheus/
│       ├── index.ts         # barrel
│       └── env.ts           # Zod-схема env Prometheus
├── scripts/
│   └── copy-dashboards.mjs  # копирует dashboards/ в dist/ при build
└── dashboards/
    ├── realtime-sse.json    # дашборд SSE/WebSocket метрик (uid: realtime-sse)
    ├── api-http.json        # дашборд NestJS HTTP метрик (uid: api-http)
    └── redis.json           # дашборд серверных метрик Redis (exporter, uid: redis)
```

## 5. Интеграция по сервисам

### 5.1 apps/api (NestJS)

- Зависимости: `@packages/observability` (workspace), `@sentry/nestjs`,
  `@sentry/profiling-node`, `prom-client`.
- `src/instrument.ts` — первый импорт в `main.ts`; `Sentry.init(sentryNestjsConfig())`
  выполняется до импорта `AppModule`, **guard по `SENTRY_DSN`** (без DSN Sentry
  не активируется). `@sentry/nestjs` v10 не предоставляет `SentryModule` —
  вместо него глобальный `MetricsModule` + `APP_INTERCEPTOR`.
- `MetricsModule` (`@Global`) — `prom-client` (коллекция по умолчанию):
  - `http_requests_total` / `http_request_duration_seconds` (histogram) /
    `nestjs_active_requests` — снимаются через `MetricsInterceptor`
    (route из `request.route?.path`).
  - `redis_connection_status` (gauge: `ready`/`error`/`close`/`reconnecting`)
    и `redis_client_errors_total` (`NOAUTH`, `ECONNREFUSED`, ...) — из
    `RedisService` (слушатели событий ioredis).
- `MetricsController` — `GET /metrics` (`@Public`, `text/plain`).
- `HttpExceptionFilter` — в ветке необработанных ошибок `captureException`.
- Через `SENTRY_*` из `env.validation.ts` (Zod, runtime-parse в `validate`).

### 5.2 apps/web и apps/landing (Next.js)

- `@sentry/nextjs`.
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
- `next.config.ts` оборачивается в `withSentryConfig`.
- Source Maps: `SENTRY_AUTH_TOKEN` + script `sentry:sourcemaps` после
  `next build`.

### 5.3 apps/realtime (Go)

- `github.com/getsentry/sentry-go` (v0.49.0) — **реализовано**:
  - `internal/sentry/sentry.go` — `sentry.Init()` + `Flush()`; guard по
    `SENTRY_DSN` (пустой DSN → no-op), конфиг через `internal/config`
    (`SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` default 0.2).
  - `internal/middleware/sentry.go` — chi middleware (транзакция `http.server`,
    тег `request_id`, breadcrumb, URL через `SanitizeURI`).
  - `internal/middleware/recovery.go` — паники отправляются в Sentry
    (`hub.RecoverWithContext`) в дополнение к JSON-ответу 500.
  - `cmd/server/main.go` — middleware после `Recoverer`, `Flush()` при
    graceful shutdown.
- `/metrics` уже существует в Prometheus text format — только настроить
  скрейпинг.
- Redis (go-redis): экспорт `PoolStats()` (total/idle/stale/hits/misses —
  критично при `PoolSize=100` из-за блокирующих XREAD в SSE) и литеральные
  метрики задержки Pub/Sub-релея событий комнат — **реализовано (шаги 8–9 PLAN)**:
  - `redis_pool_total/idle/stale` + `redis_pool_hits/misses/timeouts_total`
    (снимок `PoolStats()` на каждом скрейпе `/metrics`);
  - `realtime_ws_pubsub_lag_seconds` (histogram) — замер по метке времени
    `sentAt` внутри `PubSubMessage` между публикацией и приёмом на реплике;
  - `realtime_sse_stream_backlog_entries` (gauge) — приближённая оценка длины
    невычитанного хвоста персональных стримов (сумма `batch-1` по XREAD);
  - `realtime_sse_poll_batch_entries` (histogram) — размер пачек событий,
    прочитанных одним XREAD-поллингом.

## 6. Prometheus → Grafana

- `apps/api` отдаёт `/metrics` через `prom-client`.
- `apps/realtime` уже отдаёт `/metrics` (hand-rolled Prometheus format).
- `redis_exporter` (порт 9121) отдаёт серверные метрики Redis.
- Prometheus scrape config — три job'а: `api`, `realtime`, `redis`.

## 7. Инфраструктура (Docker Compose prod)

Добавить сервисы в `docker-compose.prod.yml`:

- `prometheus` (image `prom/prometheus`) + volume `prometheus-data`.
- `grafana` (image `grafana/grafana`) + provisioning + volume `grafana-data`.
- `redis_exporter` (image `prom/redis-exporter`) + `REDIS_ADDR=redis://redis:6379`,
  `REDIS_EXPORTER_CHECK_STREAMS=user:*:notifications`,
  `REDIS_EXPORTER_CHECK_KEYS=session:*:active`, порт `9121`.
- сеть `monitoring`.
- порт Grafana `3001:3000` (избежать коллизии с web на 3000).

```
infra/
├── prometheus/
│   └── prometheus.yml
└── grafana/
    ├── provisioning/
    │   ├── datasources/
    │   │   └── prometheus.yml
    │   └── dashboards/
    │       └── default.yml
    └── dashboards/
        ├── realtime-sse.json
        ├── api-http.json
        └── redis.json
```

## 8. Метрики

### NestJS (apps/api) — реализовано
- `http_request_duration_seconds` (histogram)
- `http_requests_total{status_code}`
- `nestjs_active_requests`
- `redis_connection_status` (gauge: `ready`/`error`/`close`/`reconnecting`)
- `redis_client_errors_total` (счётчик: `NOAUTH`, `ECONNREFUSED`, ...)

> **Известное исключение:** `prisma_pool_connections_*` — **не реализовано**:
> адаптер PrismaPg не даёт доступа к пулу `pg`. Панели в `api-http.json`
> остаются без данных.

### Realtime (apps/realtime) — уже реализовано
- `realtime_sse_connected_clients`
- `realtime_sse_active_users`
- `realtime_sse_connections_total`
- `realtime_sse_messages_dispatched_total`
- `realtime_sse_dropped_messages_total`
- `realtime_sse_redis_stream_lag_seconds`
- `realtime_sse_session_duration_seconds`
- `realtime_sse_stream_backlog_entries` — приближённая длина невычитанного
  хвоста персональных стримов (сумма `batch-1` по XREAD-поллингам)
- `realtime_sse_poll_batch_entries` — histogram размеров пачек событий за поллинг
- `realtime_ws_pubsub_lag_seconds` — задержка релея событий комнат через Pub/Sub
- `redis_pool_total/idle/stale` + `redis_pool_hits/misses/timeouts_total` —
  снимок `PoolStats()` go-redis

### Серверный Redis (redis_exporter, шаг 7 PLAN)
- `used_memory` vs `maxmemory`, `connected_clients` vs `maxclients`
- `blocked_clients` (блокирующие XREAD из SSE-ридеров)
- `evicted_keys`, `keyspace_hits/misses`, `commandstats` (латентность p50/p95)
- `slowlog`, репликационный offset, длина стримов `user:*:notifications`

---

## Изменения

### 0.4.0 — 2026-09-11
- Шаги 8–9 PLAN реализованы: `redis_pool_*` (снимок `PoolStats()`),
  `realtime_ws_pubsub_lag_seconds` (по метке `sentAt` в `PubSubMessage`),
  `realtime_sse_stream_backlog_entries` + `realtime_sse_poll_batch_entries`
  (оценка длины хвоста стримов). Метрики добавлены в `realtime-sse.json`.

### 0.3.0 — 2026-09-11
- **Phase 1 реализована** (Sentry+PROM в api/web/realtime, пакет заскаффолден):
  разделы §4/§5/§8 приведены к фактической реализации.
- §2: пакет больше не source-only — добавлен tsc-билд в CJS (требование
  `moduleResolution: "node"` в `apps/api`), dashboards копируются в `dist/`.
- §3: добавлены решения — Sentry Datasource plugin «да»; dashboards копируются
  при деплое (не тома); `maxmemory-policy` отложено; Redis-auth отложено
  (фиксация риска в `SECURITY.md` — открытый долг).
- §5.1: фактическая реализация — `instrument.ts` с guard по `SENTRY_DSN`,
  `MetricsModule` + `MetricsInterceptor` (вместо несуществующего в
  `@sentry/nestjs` v10 `SentryModule`), `captureException` в
  `HttpExceptionFilter`.
- §5.3: Sentry in realtime помечен «реализовано», `PoolStats`/Pub/Sub-лаг —
  планируется (шаги 8–9 PLAN).
- §8: `prisma_pool_connections_*` — **не реализовано** (PrismaPg не отдаёт
  пул), добавлена заметка; in-app Redis-метрики api перемещены в «реализовано».

### 0.2.0 — 2026-09-08
- Добавлен раздел наблюдения за Redis (три слоя: серверный exporter, лёгкая
  клиентская инструментация, бизнесовые метрики).
- Выбранные решения (§3): Redis exporter отдельным контейнером, лёгкая
  клиентская инструментация, без `requirepass` в прод-Redis, throttler
  отложен.
- Структура (§4) и инфраструктура (§7): добавлены `redis.json`, сервис
  `redis_exporter`, job `redis`.
- Метрики (§8): добавлены in-app и серверные Redis-метрики.
