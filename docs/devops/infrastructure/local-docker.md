# Локальная инфраструктура (Docker Compose)

Вся инфраструктура, необходимая для локальной разработки монорепозитория, описана в корневом файле [`docker-compose.yml`](../../../docker-compose.yml).

---

## 1. Состав контейнеров

```text
docker-compose.yml
├── postgres       # PostgreSQL 16 (порт 5432) — реляционная база данных
├── redis          # Redis 7 (порт 6379) — кэш, блэклисты токенов и Pub/Sub
├── minio          # MinIO (порт 9000 — S3 API, порт 9001 — Web Console)
└── minio-init     # Одноразовый CLI-контейнер для автосоздания бакетов
```

### Порты и адреса:

| Сервис | Порт хоста | Назначение | Учетные данные по умолчанию |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | `localhost:5432` | Доступ к БД для Prisma | `mock_interview / mock_interview` |
| **Redis** | `localhost:6379` | Сессии и брокер событий | пароль `mock-interview-redis` |
| **MinIO S3 API** | `localhost:9000` | S3-эндпоинт для загрузки файлов | `minioadmin / minioadmin` |
| **MinIO Console** | `localhost:9001` | Веб-интерфейс управления файлами | `minioadmin / minioadmin` |

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

## 3. Инициализация хранилища (`minio-init`)

Сервис `minio-init` автоматически стартует после успешного запуска MinIO:
1. Создает бакет `mock-interview-storage` (если он еще не существует).
2. Выставляет политику публичного чтения (`download`) для каталогов `avatars/` и `public/`.
3. Завершает работу (`exit 0`), не потребляя ресурсы.

---

## 4. Сохранение данных (Persistent Volumes)

Данные сохраняются между перезапусками в именованных Docker Volumes:
* `postgres-data` — файлы базы данных PostgreSQL.
* `redis-data` — dump/AOF файлы Redis.
* `minio-data` — загруженные файлы S3-хранилища.
