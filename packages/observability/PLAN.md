# Plan: Observability Package

**Версия:** 0.6.0

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
| 5 | Sentry в `apps/landing` | landing | P1 | ✅ сделано: `sentry.client.config.ts`, `withSentryConfig` в `next.config.ts` (guard по `SENTRY_DSN`), клиентская инициализация через `NEXT_PUBLIC_SENTRY_DSN` |
| 6 | Prometheus config + docker-compose.prod.yml | infra | P0 | ✅ сделано: `infra/` в пакете, сервисы prometheus/grafana/redis_exporter + сеть `monitoring` в `docker-compose.prod.yml`, scp в `deploy-server.yml` |
| 7 | `redis_exporter` → job `redis` + env `check_streams`/`check_keys` | infra | P0 | ✅ сделано: сервис в compose, job `redis` в prometheus.yml, `REDIS_EXPORTER_CHECK_STREAMS`/`REDIS_EXPORTER_CHECK_KEYS` |
| 8 | In-app Redis: `PoolStats` (realtime) + статус/ошибки ioredis (api) | realtime, api | P0 | ✅ сделано: `redis_pool_total/idle/stale` + `redis_pool_hits/misses/timeouts_total` (realtime), api-часть — в шаге 2 |
| 9 | `realtime_ws_pubsub_lag_seconds` + gauge длины стримов | realtime | P1 | ✅ сделано: гистограмма `realtime_ws_pubsub_lag_seconds`, counter `realtime_sse_stream_backlog_entries_total` и гистограмма `realtime_sse_poll_batch_entries` |
| 10 | Grafana provisioning + dashboards (в т.ч. `redis.json`) | infra | P1 | ✅ сделано: datasource + file-provisioning, дашборды монтируются из `packages/observability/dashboards/` |
| 11 | Alert-правила Redis (memory/evictions/stream delivery-lag) | infra | P1 | ✅ сделано: `infra/prometheus/alerting/redis.yml` (target-down, evictions, delivery-lag, pubsub-lag); нотификация — вне этапа |
| 12 | `.env.example` + docs | shared | P2 | ✅ сделано: единый `.env.example` дополнен Sentry/Grafana, SPEC/PLAN актуализированы |

**Phase 1 (P0, шаги 1–4) — завершена 2026-09-11.**
**Infra-фаза (шаги 6, 7, 10, 11) — завершена 2026-09-11.**

## 3. Env-переменные (единый .env.example)

```env
# Sentry
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=mockinterviewai
SENTRY_PROJECT=
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.2

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=
```

## 4. Turborepo

Задача `deploy:observability` не нужна: дашборды не передаются через `dist/`,
а копируются на сервер scp-шагом `deploy-server.yml` из исходных директорий
(`packages/observability/infra` + `packages/observability/dashboards`). Задача
удалена из `turbo.json`; обычный `build` пакета (`tsc`) остаётся.

## 5. Redis-мониторинг (объём этапа)

- Серверный уровень: контейнер `oliver006/redis_exporter` (порт 9121) + job `redis`.
- Клиентский уровень (лёгкий): ioredis (статус/ошибки) в API, `PoolStats`
  go-redis в realtime; без гистограмм клиентской латентности.
- Бизнесовый уровень: `realtime_ws_pubsub_lag_seconds` + контроль длины
  стримов `user:*:notifications`.
- Grafana: дашборд `redis.json` + alert-правила (memory, evictions, stream delivery-lag).
- Прод-Redis работает **без пароля**, `requirepass` — вне данного этапа.

## 6. Открытые вопросы

- [x] Использовать Sentry Datasource plugin в Grafana для корреляции ошибок
      с метриками, или связать через дашборды вручную?
      **Решение:** ставим plugin (записано в SPEC §3).
- [x] Нужен ли единый `GRAFANA_ADMIN_PASSWORD` из секрета, или достаточно
      dev-дефолта?
      **Решение:** dev-дефолт упразднён — в проде `GRAFANA_ADMIN_PASSWORD`
      обязателен (fail-closed в compose), прокидывается через
      `secrets.GRAFANA_ADMIN_PASSWORD` (записано в SPEC §7).
- [x] Копировать дашборды из пакета при деплое, или монтировать напрямую
      из репозитория?
      **Решение:** копируем при деплое — scp-шаг `deploy-server.yml`
      копирует `infra` + `dashboards` на сервер, затем compose монтирует их
      томом (read-only, перечитывание раз в 30 c); CI-шаг `deploy:observability`
      удалён (записано в SPEC §3 и §4).
- [ ] Переводить ли throttler API на Redis (`ThrottlerStorageRedis`) —
      план откладывает, документировано в `docs/backend/data/redis-caching.md`
      расходятся с фактической in-memory реализацией.
- [x] Добавлять ли `--maxmemory-policy allkeys-lru` для прод-Redis вместе с
      alert'ами на эвикцию?
      **Решение:** НЕ использовать `allkeys-lru` — эвикция молча удаляла бы
      `blacklist:token:*` (security-регрессия: токен после logout снова
      валиден) и notification-стримы (потеря уведомлений). Установлен
      `noeviction` с cap (dev 128mb / prod `${REDIS_MAXMEMORY:-512mb}`);
      оценка `volatile-lru` / отдельного cache-инстанса отложена (SPEC §3).
- [x] Redis-auth в прод (requirepass): **отложить**; фиксация риска в
      `SECURITY.md` — открытый долг (записано в SPEC §3).

## 7. Dev-контур наблюдения (готово)

**Проблема (решена):** при `turbo dev` наблюдение работало только рантаймом —
`api`/`realtime` отдают метрики, но Prometheus/Grafana/redis-exporter
существовали лишь в `docker-compose.prod.yml`. Локально дашборды не
просматривались, watch над ними отсутствовал.

**Реализация:**
1. Композ `packages/observability/infra/observability.dev.yml` (по образцу
   сервисов из `docker-compose.prod.yml`, без прод-ограничений):
   - prometheus (127.0.0.1:9090) + redis_exporter (127.0.0.1:9121) +
     grafana (127.0.0.1:3002);
   - `GRAFANA_ADMIN_PASSWORD` из `.env`, в dev без fail-closed `:?`
     (дефолт `admin`);
   - redis_exporter берёт `REDIS_PASSWORD` из `.env` (дефолт
     `mock-interview-redis` — как в dev-композе `docker-compose.yml`);
   - те же volume-маунты `infra/` и `dashboards/` → правки дашбордов
     подхватываются за `updateIntervalSeconds: 30` (провайдер отдаёт
     `allowUiUpdates: true`); `--web.enable-lifecycle` для reload-targets;
   - отдельные volumes `prometheus_dev_data`/`grafana_dev_data` — не
     пересекаются с прод-данными.
2. Отдельный dev-конфиг Prometheus `infra/prometheus/prometheus.dev.yml`:
   api/realtime скрейпятся через `host.docker.internal`
   (`:3001` — dev-дефолт `API_PORT`, `:8080` — dev-дефолт `REALTIME_PORT`;
   они запущены на хосте через `turbo dev`), redis-экспортер — по имени
   сервиса в сети композа; `extra_hosts: host.docker.internal:host-gateway`
   для Linux.
3. Запуск только по требованию:
   `docker compose --env-file .env -f packages/observability/infra/observability.dev.yml up -d`.
   НЕ подключён в `predev` api — dev-инфра остаётся лёгкой и не тянет
   мониторинг каждому разработчику. По умолчанию стек выключен, включается
   явной командой.

**Критерий готовности (выполнен):** `turbo dev` + поднятый dev-композ →
Grafana на `127.0.0.1:3002` показывает живые метрики api/realtime и
redis-экспортер, alert-правила активны; правки `dashboards/*.json`
отражаются без пересоздания контейнера.

---

## Изменения

### 0.7.9 — 2026-09-17
- **Sentry Init (apps/realtime):** `EnableTracing: TracesSampleRate > 0` — без
  него sentry-go v0.49 всегда отбрасывает span'ы (rule #1), транзакции не
  уходили. Тесты семплирования в `internal/sentry`.

### 0.7.8 — 2026-09-17
- **Sentry middleware (apps/realtime):** `r = r.WithContext(span.Context())` —
  активный span виден downstream (дочерние span'ы); `span.Finish()` → `defer`
  (finish при panic). Добавлен тест проброса span+hub (`sentry_test.go`).

### 0.7.7 — 2026-09-17
- **`MetricsInterceptor` (apps/api):** статус исключения фиксируется в
  `catchError` (`HttpException.getStatus()`, иначе 500) до `finalize` — раньше
  все ошибки записывались как 200 (finalize выполняется до `response.status`)
  и error-rate панели не видели сбои. Добавлен `metrics.interceptor.spec.ts`.

### 0.7.6 — 2026-09-17
- **`sentryClientConfig()`:** `safeParse(process.env)` → прямое чтение
  `process.env.NEXT_PUBLIC_SENTRY_DSN` / `_ENVIRONMENT` / `_TRACES_SAMPLE_RATE`
  по одному — Next.js инлайнит только прямой member access, целиком
  `process.env` в браузере недоступен (браузерный Sentry не включался). SPEC
  §5.2 уточнён.

### 0.7.5 — 2026-09-17
- Alert `RedisStreamLagHigh` (по `redis_stream_length > 100`) удалён: длина
  стрима — размер буфера (`MAXLEN ~ 100`, XREAD не удаляет записи), а не
  отставание ридера, возможны ложные срабатывания у здоровых читателей.
- Вместо него `RedisStreamDeliveryLagHigh` (группа `realtime`): p95
  `realtime_sse_redis_stream_lag_seconds` > 30s — фактическая задержка
  доставки; порог с учётом baseline `XREAD BLOCK`. SPEC §7, шаг 11 и §5
  уточнены.

### 0.7.4 — 2026-09-17
- **`redis.json` «Command Latency»:** вместо голого counter'а
  `redis_commands_duration_seconds_total` панель считает среднюю латентность
  `rate(duration[5m]) / rate(redis_commands_total[5m])` (prиказ: avg by command);
  SPEC §8 обновлён.

### 0.7.3 — 2026-09-17
- **`api-http.json` «Redis Connection Status»:** value mappings переведены на
  числовые per-series overrides (`1` → текст/цвет, `0` → пусто); строковые
  ключи не работали с числовой метрикой `redis_connection_status` (0/1).

### 0.7.2 — 2026-09-17
- **Sentry Datasource plugin запинен:** `SENTRY_DATASOURCE_VERSION` (default
  `2.2.6`) в `.env.example` и `GF_INSTALL_PLUGINS` → детерминированная
  установка при каждом старте Grafana; roadmap «образ с запечённым плагином»
  зафиксирован в SPEC §3.

### 0.7.1 — 2026-09-17
- **Закрыт вопрос `maxmemory-policy` (§6):** вместо `allkeys-lru` выбран
  `noeviction` (dev 128mb / prod cap `${REDIS_MAXMEMORY:-512mb}`) — эвикция
  удаляла бы blacklist токенов (security-регрессия) и notification-стримы.
  В `redis.yml` добавлен alert `RedisMemoryHigh` (used_memory ≥ 80% cap);
  SPEC §3 обновлён.

### 0.7.0 — 2026-09-13
- **§7 реализован:** dev-контур наблюдения — `infra/observability.dev.yml`
  (prometheus/redis_exporter/grafana на 127.0.0.1:9090/9121/3002, по
  требованию, НЕ в predev) + `infra/prometheus/prometheus.dev.yml`
  (scrape api/realtime через `host.docker.internal`, redis-экспортер по
  имени сервиса; `--web.enable-lifecycle`). `GRAFANA_ADMIN_PASSWORD`/
  `REDIS_PASSWORD` — из `.env` без fail-closed; volumes dev-изолированы.
- Верификация: YAML-валидность compose-файлов и scrape-конфига.

### 0.6.0 — 2026-09-12
- **Дашборды:** исправлена метрика длины стримов в `redis.json`
  (`redis_streams_stream_length` → `redis_stream_length`, label `{{key}}`);
  удалена пустая панель Prisma из `api-http.json`; панели всех дашбордов
  привязаны к datasource Prometheus (`"uid": "prometheus"`).
- **Infra (security):** порты Prometheus/Grafana/Redis-exporter привязаны
  к `127.0.0.1`; `GRAFANA_ADMIN_PASSWORD` обязателен (fail-closed) и
  прокидывается через секрет в `deploy-server.yml`; в Grafana установлен
  Sentry Datasource plugin (`GF_INSTALL_PLUGINS=grafana-sentry-datasource`).
- **Чистка:** удалены мёртвые `deploy:observability` из `turbo.json` и
  `scripts/copy-dashboards.mjs` — дашборды копируются scp-шагом
  `deploy-server.yml` (§4 обновлён).
- Верификация: JSON-валидность дашбордов, `docker compose config`,
  turbo-сборка — чисто.
- NEW: секция §7 «Backlog: dev-контур наблюдения» (dev-compose для
  Prometheus/Grafana/redis-exporter, по требованию); уточнены решения §3/§6
  по распространению dashboards (scp → mount, без CI-шага `deploy:observability`).

### 0.6.0 — 2026-09-11
- Infra-фаза (шаги 6, 7, 10, 11) реализована: конфиги в `packages/observability/infra/`,
  сервисы prometheus/grafana/redis_exporter + сеть `monitoring` в compose,
  file-provisioning Grafana, alert-правила в prometheus/alerting/redis.yml.
- Дашборды не дублируются: провайдер Grafana читает копию `packages/observability/dashboards/`,
  scp-шаг в `deploy-server.yml` копирует их на сервер.

### 0.5.0 — 2026-09-11
- Шаг 5 выполнен: Sentry в `apps/landing` — `sentry.client.config.ts` +
  `withSentryConfig` в `next.config.ts` (guard по `SENTRY_DSN`), зависимости
  `@packages/observability` + `@sentry/nextjs`. Статический export — только
  клиентская инициализация через `NEXT_PUBLIC_SENTRY_DSN`.
- Шаг 12 выполнен: единый `.env.example` дополнен Sentry/Grafana-блоками.
- Верификация: `tsc --noEmit`, `biome check`, `next build` (с DSN и без) — чисто.

### 0.4.0 — 2026-09-11
- Шаг 8 выполнен: `redis_pool_total/idle/stale` + `redis_pool_hits/misses/timeouts_total`
  (снимок `PoolStats()` go-redis на скрейпе `/metrics`, disabled-пул не экспортируется).
- Шаг 9 выполнен: `realtime_ws_pubsub_lag_seconds` (histogram по метке `sentAt`
  в `PubSubMessage`), `realtime_sse_stream_backlog_entries_total` (counter) +
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
