# Развёртывание на Render (render.com) через Blueprint

В проекте настроена автоматическая инфраструктурная спецификация **Render Blueprint (`render.yaml`)**, которая позволяет развернуть весь стек монорепозитория (БД, Redis, Backend, Realtime, Frontend) в одном проекте на Render.

---

## 1. Архитектура сервисов на Render

```text
                                [render.yaml Blueprint]
                                            │
       ┌────────────────────┬───────────────┼───────────────┬────────────────────┐
       ▼                    ▼               ▼               ▼                    ▼
[PostgreSQL DB]       [Redis Service]  [apps/api]      [apps/realtime]      [apps/web]
(Managed Postgres)    (Managed Cache)  (NestJS Docker) (Go WebSocket)       (Next.js Docker)
```

---

## 2. Пошаговая инструкция по деплою

### Шаг 1: Подготовка внешних сервисов (бесплатные облачные аккаунты)
1. **LiveKit Cloud** (WebRTC SFU):
   - Войдите или зарегистрируйтесь на [cloud.livekit.io](https://cloud.livekit.io/login) (бесплатный тариф до 50 ГБ трафика в месяц).
   - Скопируйте: `LIVEKIT_URL` (вида `wss://<project>.livekit.cloud`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
2. **S3 Хранилище** (аватары пользователей):
   - Создайте бесплатный Bucket в [Cloudflare R2](https://www.cloudflare.com/products/r2/) или [AWS S3](https://aws.amazon.com/s3/).
   - Получите `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`.

---

### Шаг 2: Создание Blueprint на Render
1. Зайдите в панель [dashboard.render.com](https://dashboard.render.com/).
2. Нажмите кнопку **New +** $\rightarrow$ выберите **Blueprint**.
3. Подключите ваш GitHub-репозиторий `MockInterviewAI`.
4. Render автоматически прочитает файл `render.yaml` и покажет список создаваемых ресурсов:
   - `devsync-db` (PostgreSQL)
   - `devsync-redis` (Redis)
   - `devsync-api` (Web Service Docker)
   - `devsync-realtime` (Web Service Docker)
   - `devsync-livekit` (Web Service Docker Image: livekit/livekit-server)
   - `devsync-telegram-bot` (Web Service Docker)
   - `devsync-web` (Web Service Docker)
   - `devsync-landing` (Web Service Static)
   - `devsync-ui-docs` (Web Service Static)
   - `devsync-grafana` (Web Service Docker Image: grafana/grafana)
   - `devsync-kibana` (Web Service Docker Image: kibana)
5. Нажмите **Apply**.


---

### Шаг 3: Заполнение переменных окружения
После первого применения в настройках сервисов на Render укажите несинхронизируемые переменные (`sync: false`):

#### В `devsync-api`:
- `ALLOWED_ORIGINS`: URL созданного фронтенда (например `https://devsync-web.onrender.com`).
- Для GitHub OAuth задайте все четыре значения: `GITHUB_CLIENT_ID` и
  `GITHUB_CLIENT_SECRET` из GitHub OAuth App, `GITHUB_CALLBACK_URL` =
  `https://<api-domain>/api/v1/auth/github/callback`, `FRONTEND_URL` =
  `https://<web-domain>`. Callback должен совпадать с настройкой GitHub OAuth App.
  Секрет вводится только в Render; `COOKIE_SECURE=true` уже задан в Blueprint.
  Для существующего сервиса добавьте новые `sync: false` переменные вручную
  в Environment: обновление Blueprint не добавляет их автоматически.
  Если OAuth не используется, не задавайте эти переменные (пустые строки не подходят).
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`.
- `LIVEKIT_URL`: URL LiveKit сервера (внутренний `wss://devsync-livekit.onrender.com` или внешний `wss://<project>.livekit.cloud`).
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: ключи доступа (должны совпадать с `LIVEKIT_KEYS` в `devsync-livekit`).
- `INTERNAL_SERVICE_KEY`: сервисный ключ (≥ 32 символа) для заголовка
  `X-Internal-Service-Key`. Задаётся вручную; `devsync-telegram-bot`
  автоматически получает его значение через `fromService` в Blueprint.

#### В `devsync-livekit`:
- `LIVEKIT_KEYS`: строка с парой ключ:секрет, например `myapikey: myverysecuresecret12345`.
  Эти же значения затем прописываются в `LIVEKIT_API_KEY` и `LIVEKIT_API_SECRET` сервиса `devsync-api`.

#### В `devsync-realtime`:
- `ALLOWED_ORIGINS`: URL созданного фронтенда.
- `LIVEKIT_WEBHOOK_API_KEY`, `LIVEKIT_WEBHOOK_API_SECRET`: совпадают с ключами LiveKit для верификации вебхуков.

#### В `devsync-web`:
- `NEXT_PUBLIC_APP_URL`: URL веб-приложения (например `https://devsync-web.onrender.com`).
- `NEXT_PUBLIC_SITE_URL`: URL лендинга (например `https://devsync-landing.onrender.com`).
- `NEXT_PUBLIC_API_URL`: URL бэкенда (например `https://devsync-api.onrender.com`).
- `NEXT_PUBLIC_REALTIME_URL`: URL realtime сервера (например `wss://devsync-realtime.onrender.com`).

#### В `devsync-grafana`:
- `GF_SECURITY_ADMIN_PASSWORD`: задайте надежный пароль администратора Grafana (логин по умолчанию: `admin`).

#### В `devsync-kibana`:
- `ELASTICSEARCH_HOSTS`: URL внешнего кластера Elasticsearch (например `https://elastic:secret@my-es-cluster.es.io:9243`).
  *Обратите внимание: для работы Kibana требуется кластер Elasticsearch.*

---

### Шаг 4: Применение миграций базы данных (Prisma)

После того, как PostgreSQL создана:
1. Перейдите в сервис `devsync-api` $\rightarrow$ вкладка **Shell**.

2. Выполните команду миграции:
   ```bash
   pnpm --filter api run db:migrate:deploy
   ```
*(При желании можно настроить команду `pnpm --filter api run db:migrate:deploy` в качестве `preDeployCommand` в Render).*

---

## 3. Особенности и рекомендации

- **Автоматический SSL**: Render автоматически выпускает бесплатные Let's Encrypt SSL-сертификаты для всех сервисов (`https://` и `wss://`).
- **Свои домены**: Вы можете привязать кастомный домен, например:
  - `app.yourdomain.com` $\rightarrow$ `mock-interview-web`
  - `api.yourdomain.com` $\rightarrow$ `mock-interview-api`
  - `ws.yourdomain.com` $\rightarrow$ `mock-interview-realtime`
- **Zero Downtime**: При пуше в ветку `main` Render выполняет бесшовный rolling update.
