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
   - Зарегистрируйтесь на [cloud.livekit.io](https://cloud.livekit.io/) (бесплатный тариф до 50 ГБ трафика в месяц).
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
   - `devsync-web` (Web Service Docker)
5. Нажмите **Apply**.


---

### Шаг 3: Заполнение переменных окружения
После первого применения в настройках сервисов на Render укажите несинхронизируемые переменные (`sync: false`):

#### В `devsync-api`:
- `ALLOWED_ORIGINS`: URL созданного фронтенда (например `https://devsync-web.onrender.com`).
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

#### В `devsync-realtime`:
- `ALLOWED_ORIGINS`: URL созданного фронтенда.

#### В `devsync-web`:
- `NEXT_PUBLIC_API_URL`: URL бэкенда (например `https://devsync-api.onrender.com`).
- `NEXT_PUBLIC_REALTIME_URL`: URL realtime сервера (например `wss://devsync-realtime.onrender.com`).

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
