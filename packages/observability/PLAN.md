# Plan: Observability Package

**Версия:** 0.2.0

## 1. Текущая цель

Реализовать `packages/observability` — единый пакет конфигурации Sentry +
Prometheus + Grafana для монорепо (см. `SPEC.md`).

## 2. Порядок реализации

| # | Шаг | Сервис | Приоритет |
|---|-----|--------|-----------|
| 1 | Scaffolding `packages/observability` | shared | P0 |
| 2 | Sentry в `apps/api` + `prom-client` `/metrics` (в т.ч. in-app Redis) | api | P0 |
| 3 | Sentry в `apps/web` + source maps | web | P0 |
| 4 | Sentry в `apps/realtime` (Go SDK) | realtime | P0 |
| 5 | Sentry в `apps/landing` | landing | P1 |
| 6 | Prometheus config + docker-compose.prod.yml | infra | P0 |
| 7 | `redis_exporter` → job `redis` + env `check_streams`/`check_keys` | infra | P0 |
| 8 | In-app Redis: `PoolStats` (realtime) + статус/ошибки ioredis (api) | realtime, api | P0 |
| 9 | `realtime_ws_pubsub_lag_seconds` + gauge длины стримов | realtime | P1 |
| 10 | Grafana provisioning + dashboards (в т.ч. `redis.json`) | infra | P1 |
| 11 | Alert-правила Redis (memory/evictions/stream-lag) | infra | P1 |
| 12 | `.env.example` + docs | shared | P2 |

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

- [ ] Использовать Sentry Datasource plugin в Grafana для корреляции ошибок
      с метриками, или связать через дашборды вручную?
- [ ] Нужен ли единый `GRAFANA_ADMIN_PASSWORD` из секрета, или достаточно
      dev-дефолта?
- [ ] Копировать дашборды из пакета при деплое, или монтировать напрямую
      из репозитория?
- [ ] Переводить ли throttler API на Redis (`ThrottlerStorageRedis`) —
      план откладывает, документировано в `docs/backend/data/redis-caching.md`
      расходятся с фактической in-memory реализацией.
- [ ] Добавлять ли `--maxmemory-policy allkeys-lru` для прод-Redis вместе с
      alert'ами на эвикцию?

---

## Изменения

### 0.2.0 — 2026-09-08
- В порядок реализации добавлены шаги Redis-мониторинга (7–11) с приоритетами
  P0/P1.
- Добавлен раздел §5 «Redis-мониторинг (объём этапа)».
- Открытые вопросы дополнены: throttler на Redis и `maxmemory-policy`.
