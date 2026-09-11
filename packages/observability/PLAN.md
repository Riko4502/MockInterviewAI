# Plan: Observability Package

**Версия:** 0.4.0

## 1. Текущая цель

Реализовать `packages/observability` — единый пакет конфигурации Sentry +
Prometheus + Grafana для монорепо (см. `SPEC.md`).

## 2. Порядок реализации

| # | Шаг | Сервис | Приоритет | Статус |
|---|-----|--------|-----------|--------|
| 1 | Scaffolding `packages/observability` | shared | P0 | ✅ сделано |
| 2 | Sentry в `apps/api` + `prom-client` `/metrics` (в т.ч. in-app Redis) | api | P0 | ✅ сделано |
| 3 | Sentry в `apps/web` + source maps | web | P0 | ✅ сделано |
| 4 | Sentry в `apps/realtime` (Go SDK) | realtime | P0 | ✅ сделано |
| 5 | Sentry в `apps/landing` | landing | P1 | ⏳ |
| 6 | Prometheus config + docker-compose.prod.yml | infra | P0 | ⏳ |
| 7 | `redis_exporter` → job `redis` + env `check_streams`/`check_keys` | infra | P0 | ⏳ |
| 8 | In-app Redis: `PoolStats` (realtime) + статус/ошибки ioredis (api) | realtime, api | P0 | ✅ сделано: `redis_pool_total/idle/stale` + `redis_pool_hits/misses/timeouts_total` (realtime), api-часть — в шаге 2 |
| 9 | `realtime_ws_pubsub_lag_seconds` + gauge длины стримов | realtime | P1 | ✅ сделано: гистограмма `realtime_ws_pubsub_lag_seconds` + gauge `realtime_sse_stream_backlog_entries` и гистограмма `realtime_sse_poll_batch_entries` |
| 10 | Grafana provisioning + dashboards (в т.ч. `redis.json`) | infra | P1 | ⏳ |
| 11 | Alert-правила Redis (memory/evictions/stream-lag) | infra | P1 | ⏳ |
| 12 | `.env.example` + docs | shared | P2 | 🟡 частично: `.env.example` realtime дополнен, общий — ⏳ |

**Phase 1 (P0, шаги 1–4) — завершена 2026-09-11.** Дальше по шагам 6–12
останавливаемся до подтверждения.

## 3. Env-переменные (единый .env.example)

```env
# Sentry
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=mockinterviewai
SENTRY_PROJECT=
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.2

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=
```

## 4. Turborepo

Добавить в `turbo.json` задачу `deploy:observability`, которая зависит от
`^build` и копирует JSON-дашборды в `dist/`.

## 5. Redis-мониторинг (объём этапа)

- Серверный уровень: контейнер `prom/redis-exporter` (порт 9121) + job `redis`.
- Клиентский уровень (лёгкий): ioredis (статус/ошибки) в API, `PoolStats`
  go-redis в realtime; без гистограмм клиентской латентности.
- Бизнесовый уровень: `realtime_ws_pubsub_lag_seconds` + контроль длины
  стримов `user:*:notifications`.
- Grafana: дашборд `redis.json` + alert-правила (memory, evictions, stream-lag).
- Прод-Redis работает **без пароля**, `requirepass` — вне данного этапа.

## 6. Открытые вопросы

- [x] Использовать Sentry Datasource plugin в Grafana для корреляции ошибок
      с метриками, или связать через дашборды вручную?
      **Решение:** ставим plugin (записано в SPEC §3).
- [ ] Нужен ли единый `GRAFANA_ADMIN_PASSWORD` из секрета, или достаточно
      dev-дефолта?
- [x] Копировать дашборды из пакета при деплое, или монтировать напрямую
      из репозитория?
      **Решение:** копировать при деплое (CI-шаг `deploy:observability`),
      тома не монтируем (записано в SPEC §3).
- [ ] Переводить ли throttler API на Redis (`ThrottlerStorageRedis`) —
      план откладывает, документировано в `docs/backend/data/redis-caching.md`
      расходятся с фактической in-memory реализацией.
- [x] Добавлять ли `--maxmemory-policy allkeys-lru` для прод-Redis вместе с
      alert'ами на эвикцию?
      **Решение:** отложить до анализа usage-паттернов (записано в SPEC §3).
- [x] Redis-auth в прод (requirepass): **отложить**; фиксация риска в
      `SECURITY.md` — открытый долг (записано в SPEC §3).

---

## Изменения

### 0.4.0 — 2026-09-11
- Шаг 8 выполнен: `redis_pool_total/idle/stale` + `redis_pool_hits/misses/timeouts_total`
  (снимок `PoolStats()` go-redis на скрейпе `/metrics`, disabled-пул не экспортируется).
- Шаг 9 выполнен: `realtime_ws_pubsub_lag_seconds` (histogram по метке `sentAt`
  в `PubSubMessage`), `realtime_sse_stream_backlog_entries` (gauge) +
  `realtime_sse_poll_batch_entries` (histogram).
- Метрики добавлены в `dashboards/realtime-sse.json` (WS lag, pool, stream backlog).

### 0.3.0 — 2026-09-11
- **Phase 1 (шаги 1–4) реализована:** scaffolding, Sentry в api/web/realtime,
  prom-client `/metrics` в api.
- Таблица §2 дополнена колонкой «Статус»; неоткрытые вопросы §6 закрыты
  решениями, новые решения перенесены в SPEC §3.
- Шаг 12 помечен как частично выполненный (`.env.example` realtime).
- Верификация Phase 1: `go build`/`go vet`/`go test ./...` (realtime),
  `nest build` + 281 тест (api), `typecheck`/`lint`/`next build` через turbo
  (web) — чисто.

### 0.2.0 — 2026-09-08
- В порядок реализации добавлены шаги Redis-мониторинга (7–11) с приоритетами
  P0/P1.
- Добавлен раздел §5 «Redis-мониторинг (объём этапа)».
- Открытые вопросы дополнены: throttler на Redis и `maxmemory-policy`.
