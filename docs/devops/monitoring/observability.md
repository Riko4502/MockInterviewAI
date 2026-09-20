# Наблюдение за приложением (Observability)

Платформа наблюдается на двух уровнях: **Sentry** — ошибки и трассировки,
**Prometheus + Grafana** — метрики приложений и серверного Redis.
Пакет описан в [`packages/observability/README.md`](../../../packages/observability/README.md);
инфраструктура детально — в [`packages/observability/SPEC.md`](../../../packages/observability/SPEC.md)
и [`packages/observability/PLAN.md`](../../../packages/observability/PLAN.md) (статусы и roadmap).

---

## 1. Что входит в стек

| Компонент | Назначение | Где живёт |
| :--- | :--- | :--- |
| **Sentry** | Ошибки, паники, трассировки (server + browser) | `apps/api`, `apps/web`, `apps/landing`, `apps/realtime` |
| **Prometheus** | Сбор и хранение метрик, alert-правила | `packages/observability/infra/prometheus` |
| **Grafana** | Дашборды поверх Prometheus (file-provisioning) | `packages/observability/infra/grafana` + `dashboards` |
| **redis_exporter** | Метрики серверного Redis | сервис в `docker-compose.prod.yml` / dev-compose |

### Эндпоинты метрик (работают всегда, без env)

| Сервис | Endpoint | Что отдаёт |
| :--- | :--- | :--- |
| api | `GET :3001/api/v1/metrics` | HTTP-метрики, состояние соединения ioredis |
| realtime | `GET :8080/metrics` | PoolStats go-redis, pub/sub lag, SSE backlog |

---

## 2. Быстрый старт

### Локально: посмотреть метрики без инфраструктуры

```bash
curl http://localhost:3001/api/v1/metrics   # api (NestJS, prom-client)
curl http://localhost:8080/metrics          # realtime (Go)
```

### Локально: поднять Prometheus + Grafana + redis_exporter (dev-контур)

Запускается **по требованию**, в `predev` не подключён:

```bash
docker compose --env-file .env -f packages/observability/infra/observability.dev.yml up -d
# остановка: docker compose --env-file .env -f packages/observability/infra/observability.dev.yml down
```

| Сервис | Адрес | Логин/Пароль |
| :--- | :--- | :--- |
| Prometheus | `http://127.0.0.1:9090` | — |
| grafana | `http://127.0.0.1:3002` | `admin` / `${GRAFANA_ADMIN_PASSWORD:-admin}` |
| redis_exporter | `http://127.0.0.1:9121/metrics` | пароль Redis из `REDIS_PASSWORD` |

Scrape-таргеты: api на `host.docker.internal:3001`, realtime на `host.docker.internal:8080`
(дефолтные dev-порты, см. §4). Правки дашбордов в `packages/observability/dashboards/*.json`
подхватываются без пересоздания контейнера (file-provisioning, `updateIntervalSeconds: 30`).

### Прод: docker-compose.prod.yml

Те же сервисы, но с прод-ограничениями: порты привязаны к `127.0.0.1`
(Prometheus 9090, Grafana **3001**, redis_exporter 9121), `GRAFANA_ADMIN_PASSWORD`
**обязателен** (fail-closed), Grafana на `127.0.0.1:3001` (чтобы не конфликтовать
с web на 3000). Конфиги копируются на сервер scp-шагом `deploy-server.yml` —
источник истины дашбордов `packages/observability/dashboards/`.

---

## 3. Включение Sentry

По умолчанию Sentry выключен (пустые DSN → no-op). Чтобы включить локально,
задайте в `.env` и перезапустите приложение:

| Переменная | Где используется |
| :--- | :--- |
| `SENTRY_DSN` | api (server), web (server/edge), realtime |
| `NEXT_PUBLIC_SENTRY_DSN` | web / landing (браузер) |
| `SENTRY_ENVIRONMENT` | тег окружения (например `development`) |
| `SENTRY_TRACES_SAMPLE_RATE` | доля трассировок (дефолт `0.2`) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | web / landing (браузер) — тег окружения |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | web / landing (браузер) — доля трассировок |

В dev **не нужны** `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` — они
используются только при сборке (upload source maps).

---

## 4. Порты приложений

| Приложение | Адрес | Примечание |
| :--- | :--- | :--- |
| api | `localhost:3001` | дефолт `API_PORT` |
| realtime | `localhost:8080` | дефолт `REALTIME_PORT` |
| web | `localhost:3000` | Next.js |
| landing | `localhost:4321` | Next.js, статический export |

---

## 5. Дашборды и alert-правила

Дашборды (`packages/observability/dashboards/`): `api-http.json`, `realtime-sse.json`, `redis.json`.

Alert-правила (`packages/observability/infra/prometheus/alerting/redis.yml`):
`RedisTargetDown`, `RedisMemoryHigh`, `RedisEvictions`, `RealtimePubSubLagHigh`,
`RedisStreamDeliveryLagHigh`, `ApiTargetDown`, `RealtimeTargetDown`.
Alertmanager-нотификация (Telegram) — вне этапа.

Известное исключение: `prisma_pool_connections_*` не реализованы (адаптер
PrismaPg не даёт доступа к пулу `pg`) — панель в дашборде удалена.

---

## 6. Куда дальше

- [`packages/observability/README.md`](../../../packages/observability/README.md) — обзор пакета, публичный API и env-переменные;
- [`packages/observability/SPEC.md`](../../../packages/observability/SPEC.md) — архитектура и все метрики;
- [`packages/observability/PLAN.md`](../../../packages/observability/PLAN.md) — статус реализации и §7 (dev-контур);
- [`docker-compose.prod.yml`](../../../docker-compose.prod.yml) и [`packages/observability/infra/`](../../../packages/observability/infra/) — конфиги
  Prometheus/Grafana/redis_exporter (прод и dev);
- [`docs/devops/monitoring/telegram-alerts.md`](./telegram-alerts.md) — CI/деплой-уведомления.