# Spec: Observability Package

**Версия:** 0.2.0

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
2. Пакет source-only (как `@packages/tailwind-config`) — без продакшн-билда
   для конфигов; допускается сборка копирования JSON-дашбордов.
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
│   │   ├── env.ts          # Zod-схема env Sentry
│   │   ├── nestjs.config.ts # пресет для @sentry/nestjs
│   │   └── nextjs.config.ts # пресет для @sentry/nextjs
│   └── prometheus/
│       └── env.ts          # Zod-схема env Prometheus
└── dashboards/
    ├── realtime-sse.json    # дашборд SSE/WebSocket метрик
    ├── api-http.json        # дашборд NestJS HTTP метрик
    └── redis.json           # дашборд серверных метрик Redis (exporter)
```

## 5. Интеграция по сервисам

### 5.1 apps/api (NestJS)

- Зависимости: `@sentry/nestjs`, `@sentry/profiling-node`, `prom-client`.
- `Sentry.init()` выполняется до импорта `AppModule` (через `instrument.js`).
- `SentryModule.forRoot()` как глобальный модуль.
- Sentry Interceptor — автоматический трекинг HTTP-транзакций.
- Sentry Filter — расширение `HttpExceptionFilter`, `captureException` +
  breadcrumbs.
- `prom-client` → эндпоинт `/metrics` (HTTP status, duration, активные
  запросы, пул Prisma).
- Redis (ioredis): экспорт gauge статуса соединения (`ready`, `error`,
  `close`, `reconnecting`) и счётчика ошибок клиента (`NOAUTH`, `ECONNREFUSED`).

### 5.2 apps/web и apps/landing (Next.js)

- `@sentry/nextjs`.
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
- `next.config.ts` оборачивается в `withSentryConfig`.
- Source Maps: `SENTRY_AUTH_TOKEN` + script `sentry:sourcemaps` после
  `next build`.

### 5.3 apps/realtime (Go)

- `github.com/getsentry/sentry-go`.
- `internal/sentry/sentry.go` — `sentry.Init()` + `Flush()`.
- `internal/middleware/sentry.go` — chi middleware (span + recovery).
- `/metrics` уже существует в Prometheus text format — только настроить
  скрейпинг.
- Redis (go-redis): экспорт `PoolStats()` (total/idle/stale/hits/misses —
  критично при `PoolSize=100` из-за блокирующих XREAD в SSE) и литеральные
  метрики задержки Pub/Sub-релея событий комнат.

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

## 8. Планируемые метрики

### NestJS (apps/api)
- `http_request_duration_seconds` (histogram)
- `http_requests_total{status_code}`
- `prisma_pool_connections_*`
- `nestjs_active_requests`

### Realtime (apps/realtime) — уже реализовано
- `realtime_sse_connected_clients`
- `realtime_sse_active_users`
- `realtime_sse_connections_total`
- `realtime_sse_messages_dispatched_total`
- `realtime_sse_dropped_messages_total`
- `realtime_sse_redis_stream_lag_seconds`
- `realtime_sse_session_duration_seconds`

### Realtime (apps/realtime) — планируется
- `redis_pool_*` — `PoolStats()`: total/idle/stale активные, hits/misses/timeouts
- `realtime_ws_pubsub_lag_seconds` — задержка релея событий комнат через Pub/Sub

### In-app Redis (apps/api)
- `redis_connection_status` (gauge: `ready`/`error`/`close`/`reconnecting`)
- `redis_client_errors_total` (счётчик: `NOAUTH`, `ECONNREFUSED`, ...)

### Серверный Redis (redis_exporter)
- `used_memory` vs `maxmemory`, `connected_clients` vs `maxclients`
- `blocked_clients` (блокирующие XREAD из SSE-ридеров)
- `evicted_keys`, `keyspace_hits/misses`, `commandstats` (латентность p50/p95)
- `slowlog`, репликационный offset, длина стримов `user:*:notifications`

---

## Изменения

### 0.2.0 — 2026-09-08
- Добавлен раздел наблюдения за Redis (три слоя: серверный exporter, лёгкая
  клиентская инструментация, бизнесовые метрики).
- Выбранные решения (§3): Redis exporter отдельным контейнером, лёгкая
  клиентская инструментация, без `requirepass` в прод-Redis, throttler
  отложен.
- Структура (§4) и инфраструктура (§7): добавлены `redis.json`, сервис
  `redis_exporter`, job `redis`.
- Метрики (§8): добавлены in-app и серверные Redis-метрики.
