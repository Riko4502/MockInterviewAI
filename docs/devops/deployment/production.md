# Production Деплой и Docker

В продакшене все сервисы платформы запускаются в виде контейнеризированных Docker-образов под управлением [`docker-compose.prod.yml`](../../../docker-compose.prod.yml).

---

## 1. Стек сервисов в продакшене

```text
docker-compose.prod.yml
├── redis          # Redis 7 (кэш и pub/sub)
├── api            # ghcr.io/.../mockinterviewai-api (порт 4000)
├── realtime       # ghcr.io/.../mockinterviewai-realtime (порт 8080)
└── web            # ghcr.io/.../mockinterviewai-web (порт 3000)
```

> **Внешние управляемые сервисы (Managed):**
> * **PostgreSQL**: разворачивается как Managed DB (AWS RDS / Supabase / Selectel) с автоматическими бэкапами.
> * **S3 Storage**: облачное объектное хранилище (Cloudflare R2 / AWS S3) с подключенным CDN.

---

## 1.1. Общие секреты и переменные окружения

API и Realtime аутентифицируют WebSocket через тикеты (`POST /realtime/ticket` → `Sec-WebSocket-Protocol: realtime, <ticket>`), поэтому критичен общий ключ подписи JWT:

| Переменная | Сервисы | Назначение | Требования в prod |
| :--- | :--- | :--- | :--- |
| `JWT_ACCESS_SECRET` | `api`, `realtime` | Подпись/верификация JWT (access + тикеты). **Должен совпадать** у обоих сервисов | общий секрет из единого `.env` / секретов деплоя |
| `ALLOWED_ORIGINS` | `realtime`, `api` | Origin-проверка handshake и тикет-эндпоинта. Шаблон `*` — **запрещен** в prod (в dev допустим) | реальные домены платформы |
| `REDIS_URL` | `api`, `realtime` | Сессии и их зеркала (`session:{id}:*`), блэклисты токенов, канал `auth:revocations`. Redis — hard-зависимость API при старте | managed Redis / общий VPC |

Порядок деплоя: `api` и `realtime` выкатываются **согласованно** — строгий режим `fail-closed` в realtime (обязательный тикет) вводится вместе с выпуском тикетов на API, иначе активные клиенты без тикета будут разорваны (`401`).

---

## 2. Dockerfile паттерны (Multi-Stage Builds)

Каждое приложение в `apps/` использует многоэтапную сборку (Multi-stage build) для минимизации размера и изоляции исходников:

1. **`apps/web/Dockerfile`**:
   - `base`: установка pnpm и Node.js.
   - `builder`: сборка Next.js в `standalone` режиме (`next.config.ts` $\rightarrow$ `output: "standalone"`).
   - `runner`: запуск легковесного Node.js контейнера (~120 МБ) без devDependencies.
2. **`apps/realtime/Dockerfile`**:
   - `builder`: компиляция Go в статический бинарник без CGO (`CGO_ENABLED=0`).
   - `runner`: образ на базе `alpine` или `scratch` (~20 МБ).

---

## 3. Процесс деплоя на сервер (`.github/workflows/deploy-server.yml`)

Пайплайн деплоя по SSH выполняет:
1. `docker compose -f docker-compose.prod.yml pull` — скачивание свежих образов.
2. Выполнение миграций Prisma: `pnpm --filter api run db:migrate:deploy`.
3. `docker compose -f docker-compose.prod.yml up -d --remove-orphans` — бесшовный перезапуск контейнеров.
4. Проверка доступности: опрос `/api/v1/health` и отправка статуса в Telegram.
