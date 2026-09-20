# @packages/observability

Единый observability-пакет монорепозитория **MockInterviewAI**: концентрирует
конфигурацию **Sentry** (ошибки и трассировки) и **Prometheus + Grafana**
(метрики и дашборды) и переиспользуется всеми приложениями:

- `apps/api` — NestJS (REST);
- `apps/web` — Next.js (SSR);
- `apps/landing` — Next.js (статический export);
- `apps/realtime` — Go (WebSocket/SSE) — пакет **не** используется, Sentry и
  метрики там реализованы самостоятельно в `apps/realtime/internal`.

Пакет не содержит рантайм-логики: он отдаёт пресеты конфигурации SDK,
Zod-схемы env-переменных и файлы инфраструктуры (дашборды, Prometheus,
Grafana provisioning). Без DSN Sentry остаётся выключенным (no-op); метрики
работают всегда.

> Детальная архитектура, перечень всех метрик и changelog — в
> [`SPEC.md`](./SPEC.md); статусы и roadmap — в [`PLAN.md`](./PLAN.md);
> user-guide уровня репозитория — в
> [`docs/devops/monitoring/observability.md`](../../docs/devops/monitoring/observability.md).

---

## Состав пакета

```
packages/observability/
├── src/
│   ├── index.ts            # barrel: Sentry + Prometheus
│   └── sentry/
│   │   ├── index.ts        # barrel (full, Node-only safe)
│   │   ├── edge.ts         # edge-safe barrel (sentryRuntimeConfig только)
│   │   ├── client.ts       # browser-safe barrel (sentryClientConfig только)
│   │   ├── env.ts          # Zod-схема Sentry env
│   │   ├── nestjs.config.ts
│   │   ├── nextjs.config.ts
│   │   ├── runtime.config.ts
│   │   └── client.config.ts
│   └── prometheus/
│       ├── index.ts        # barrel
│       └── env.ts          # Zod-схема Prometheus/Grafana env
├── dashboards/
│   ├── api-http.json       # API HTTP Metrics (uid: api-http)
│   ├── realtime-sse.json   # Realtime SSE Metrics (uid: realtime-sse)
│   └── redis.json          # Redis Metrics (uid: redis)
└── infra/
    ├── observability.dev.yml            # dev-контур (по требованию)
    ├── prometheus/
    │   ├── prometheus.yml               # scrape (прод): api, realtime, redis
    │   ├── prometheus.dev.yml           # scrape (dev) через host.docker.internal
    │   └── alerting/redis.yml           # alert-правила
    └── grafana/provisioning/
        ├── datasources/prometheus.yml
        └── dashboards/default.yml       # provider → /var/lib/grafana/dashboards
```

Дашборды — единый источник истины (`dashboards/`), при деплое копируются
scp-шагом `deploy-server.yml` и монтируются в Grafana (file-provisioning).

---

## Публичный API

### Entry point `@packages/observability`

| Экспорт | Назначение |
| :--- | :--- |
| `sentryNestjsConfig()` | Пресет для `@sentry/nestjs` (Node): DSN, environment, traces, profiling (`nodeProfilingIntegration`), отбрасывает транзакции `/health` |
| `sentryRuntimeConfig()` | Пресет для `sentry.server.config.ts` / `sentry.edge.config.ts` в Next.js |
| `sentryNextjsConfig()` | Build-time конфиг для `withSentryConfig(nextConfig, …)` (upload source maps) |
| `sentryClientConfig()` | Браузерный пресет (`NEXT_PUBLIC_*`); возвращает `null` без DSN → no-op |
| `sentryEnv` / `SentryEnv` | Zod-схема и тип Sentry env |
| `prometheusEnv` / `PrometheusEnv` | Zod-схема и тип Prometheus/Grafana env |

### Сублимиты

| Entry point | Что экспортирует | Когда использовать |
| :--- | :--- | :--- |
| `@packages/observability/sentry` | всё Sentry (как корень) | серверный рантайм (api, Next server) |
| `@packages/observability/sentry/edge` | `sentryRuntimeConfig` | `sentry.edge.config.ts` (без `@sentry/profiling-node`) |
| `@packages/observability/sentry/client` | `sentryClientConfig` | `sentry.client.config.ts` (browser-safe, без Node-зависимостей) |
| `@packages/observability/prometheus` | `prometheusEnv`, `PrometheusEnv` | валидация env Prometheus/Grafana |

Все конфиги с `Sentry` используют строгую Zod-валидацию (`sentryEnv.parse`) и
бросят ошибку при некорректном `SENTRY_DSN`, поэтому вызываются только под
guard'ом по DSN.

---

## Переменные окружения

### Sentry

| Переменная | Обязательная | Дефолт | Назначение |
| :--- | :--- | :--- | :--- |
| `SENTRY_DSN` | runtime | — | серверная инициализация (api, web server/edge, realtime); без неё Sentry не активируется |
| `NEXT_PUBLIC_SENTRY_DSN` | браузер | — | браузерная инициализация web/landing |
| `SENTRY_ENVIRONMENT` | — | `production` | тег окружения (`development`/`staging`/`production`) |
| `SENTRY_TRACES_SAMPLE_RATE` | — | `0.2` | доля трассировок (0..1) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | — | — | браузерные аналоги (инлайнятся на сборке) |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | — | `SENTRY_ORG=mockinterviewai` | только на сборке (upload source maps) |

### Prometheus / Grafana

| Переменная | Обязательная | Дефолт | Назначение |
| :--- | :--- | :--- | :--- |
| `PROMETHEUS_PORT` | — | `9090` | порт Prometheus |
| `PROMETHEUS_SCRAPE_INTERVAL` | — | `15s` | интервал скрейпинга |
| `GRAFANA_ADMIN_USER` | — | `admin` | админ Grafana |
| `GRAFANA_ADMIN_PASSWORD` | прод (fail-closed) | dev: `admin` | админ Grafana; в проде обязательна (`:?` в compose) |
| `REDIS_PASSWORD` | dev-контур | — | пароль Redis для `redis_exporter` (должен совпадать с паролем dev-Redis) |

---

## Интеграция по сервисам

### apps/api (NestJS)

`src/instrument.ts` — первый импорт в `main.ts`, `init()` до импорта
`AppModule`, guard по `SENTRY_DSN`:

```ts
import { sentryNestjsConfig } from "@packages/observability";
import { init } from "@sentry/nestjs";

// Без SENTRY_DSN init не вызывается — Sentry остаётся no-op
// (конфиги падают при некорректном DSN, см. «Публичный API»).
if (process.env.SENTRY_DSN) {
  init(sentryNestjsConfig());
}
```

Метрики: `MetricsModule` (`@Global`, prom-client) — `http_requests_total`,
`http_request_duration_seconds`, `nestjs_active_requests`,
`redis_connection_status`, `redis_client_errors_total`;
`GET /api/v1/metrics` (`@Public`, `text/plain`).

### apps/web (Next.js, SSR)

- `sentry.client.config.ts` → `@packages/observability/sentry/client`;
- `sentry.server.config.ts` / `sentry.edge.config.ts` → `@packages/observability/sentry` / `.../sentry/edge`;
- `next.config.ts` → `withSentryConfig(nextConfig, sentryNextjsConfig())` (под guard по `SENTRY_DSN`, иначе не оборачивается).

### apps/landing (Next.js, статический export)

Только клиентская инициализация через `NEXT_PUBLIC_SENTRY_DSN`
(`@packages/observability/sentry/client`); `withSentryConfig` — только
build-плагин загрузки source maps.

---

## Разработка пакета

```bash
pnpm --filter @packages/observability build      # tsc → dist/
pnpm --filter @packages/observability typecheck  # tsc --noEmit
pnpm --filter @packages/observability lint       # biome check
pnpm --filter @packages/observability dev        # tsc --watch (turbo dev: predev tsc)
```

Dev-контур наблюдения (Prometheus `127.0.0.1:9090`, Grafana `127.0.0.1:3002`,
redis_exporter `127.0.0.1:9121`) поднимается по требованию — команды и
особенности в [`SPEC.md §9`](./SPEC.md) и
[`docs/devops/monitoring/observability.md`](../../docs/devops/monitoring/observability.md).

---

## Linked docs

- [`SPEC.md`](./SPEC.md) — архитектура, решения, все метрики, инфраструктура;
- [`PLAN.md`](./PLAN.md) — статусы шагов и roadmap;
- [`docs/devops/monitoring/observability.md`](../../docs/devops/monitoring/observability.md) — быстрый старт (локально и в проде).
