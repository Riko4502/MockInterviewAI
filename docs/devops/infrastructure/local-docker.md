# Локальная инфраструктура (Docker Compose)

Вся инфраструктура, необходимая для локальной разработки монорепозитория, описана в корневом файле [`docker-compose.yml`](../../../docker-compose.yml).

---

## 1. Состав контейнеров

```text
docker-compose.yml
├── postgres       # PostgreSQL 16 (порт 5432) — реляционная база данных
├── redis          # Redis 7 (порт 6379) — кэш, блэклисты токенов и Pub/Sub
├── minio          # MinIO (порт 9000 — S3 API, порт 9001 — Web Console)
├── livekit        # LiveKit SFU (порт 7880 — WS-сигналинг, 7881 — HTTPS, 50000–50200 — UDP-медиа)
└── minio-init     # Одноразовый CLI-контейнер для автосоздания бакетов
```

### Порты и адреса:

| Сервис | Порт хоста | Назначение | Учетные данные по умолчанию |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | `localhost:5432` | Доступ к БД для Prisma | `mock_interview / mock_interview` |
| **Redis** | `localhost:6379` | Сессии и брокер событий | пароль `mock-interview-redis` |
| **MinIO S3 API** | `localhost:9000` | S3-эндпоинт для загрузки файлов | `minioadmin / minioadmin` |
| **MinIO Console** | `localhost:9001` | Веб-интерфейс управления файлами | `minioadmin / minioadmin` |
| **LiveKit** | `localhost:7880` | WebSocket-сигналинг WebRTC, отдаётся как `serverUrl` в join-токене | ключ `devkey` / секрет `dev-local-secret-change-me-0123456789` |
| **LiveKit** | `localhost:7881` | HTTPS-эндпоинт (для продакшена/внешних клиентов) | — |
| **LiveKit** | `localhost:50000–50200` | UDP-диапазон медиапотоков (аудио/видео) | — |

---

## 2. Команды управления

Для удобства разработчиков управление контейнерами вынесено в корневой [`package.json`](../../../package.json):

```bash
# Запуск всей инфраструктуры в фоновом режиме с ожиданием healthchecks
pnpm run infra:up

# Остановка и удаление контейнеров
pnpm run infra:down
```

---

## 3. Redis — обязательная зависимость для тестов API

End-to-end тесты API (в т.ч. `realtime-ticket.e2e-spec.ts` — ходят в аутентифицированный маршрут выпуска тикетов) зависят от Redis (сессии, блэклисты, зеркала `session:{id}:*`):

```bash
pnpm run infra:up          # поднять PostgreSQL, Redis, MinIO
pnpm --filter api test:e2e # e2e API (требует живой Redis)
```

Юнит-тесты API Redis не требуют.

---

## 4. Инициализация хранилища (`minio-init`)

Сервис `minio-init` автоматически стартует после успешного запуска MinIO:
1. Создает бакет `mock-interview-storage` (если он еще не существует).
2. Выставляет политику публичного чтения (`download`) для каталогов `avatars/` и `public/`.
3. Завершает работу (`exit 0`), не потребляя ресурсы.

---

## 5. Сохранение данных (Persistent Volumes)

Данные сохраняются между перезапусками в именованных Docker Volumes:
* `postgres-data` — файлы базы данных PostgreSQL.
* `redis-data` — dump/AOF файлы Redis.
* `minio-data` — загруженные файлы S3-хранилища.

---

## 6. LiveKit — SFU для WebRTC

* Секрет `LIVEKIT_API_SECRET` и webhook-секрет должны быть **≥32 символов** (требование livekit-server). Dev-дефолт — `dev-local-secret-change-me-0123456789` (задан в `docker-compose.yml`, корневом `.env` и `.env.example`). `apps/api` подписывает join-токены этим же секретом — рассогласование (например, дефолт API «вручную» вместо значения `.env`) приведёт к отказу `JOIN` в LiveKit.
* В dev-композе webhook-URL контейнеру не задаётся (нет публичного адреса до realtime). Для ручного e2e записи через `livekit-cli` прогон выполняется с `LIVEKIT_WEBHOOK_URL=http://host.docker.internal:8080/webhooks/livekit` — иначе события egress не дойдут до realtime. Шаги — в `apps/api/docs/plan-livekit-media.md` (Phase 5).
