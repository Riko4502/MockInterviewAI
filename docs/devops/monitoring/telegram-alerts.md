# Мониторинг и Telegram Алерты

Платформа интегрирована с Telegram-ботом для мгновенного тихого оповещения команды о результатах проверок CI, статусе деплоя, мерже в changelog и публикации новых релизов.

---

## 1. Разделение по топикам чата (Forum Supergroup)

В группе разработчиков используются топики (threads) для изоляции уведомлений:

| Топик | Назначение | GitHub Workflow |
| :--- | :--- | :--- |
| **CI / Checks** | Результаты прохождения тестов, линтеров и security сканирования в PR | `notify-ci-telegram.yml` |
| **Deployments** | Статус раскатки на продакшн-сервер (успех / ошибка / откат) | `notify-deploy-telegram.yml` |
| **Releases** | Анонсы релизов с версиями, changelog и ссылкой на скачивание | `release.yml` |
| **Changelog** | Записи о каждом смерженном PR в `main` или `dev` | `notify-changelog-telegram.yml` |

---

## 2. Спецификация GitHub Secrets

Для работы пайплайнов в репозитории настраиваются следующие секреты (`Settings -> Secrets and variables -> Actions`):

### 🤖 Telegram Bot:
* `TELEGRAM_BOT_TOKEN`: токен бота от `@BotFather`.
* `TELEGRAM_CHAT_ID`: ID супергруппы Telegram (начинается с `-100...`).
* `TELEGRAM_THREAD_ID`: основной топик чата.
* `TELEGRAM_RELEASE_THREAD_ID`: отдельный топик для релизов (опционально).
* `TELEGRAM_CHANGELOG_THREAD_ID`: топик для чейнджлога (опционально).

### ☁️ S3 Object Storage:
* `S3_ENDPOINT`: URL эндпоинта (например, `https://<account_id>.r2.cloudflarestorage.com`).
* `S3_REGION`: регион бакета (`us-east-1` или `auto`).
* `S3_ACCESS_KEY`: Access Key идентификатор.
* `S3_SECRET_KEY`: Secret Key пароль.
* `S3_BUCKET_NAME`: название бакета (`mock-interview-storage`).
* `S3_PUBLIC_URL`: публичный базовый URL раздачи через CDN.

### 🖥️ Серверный деплой (SSH):
* `SSH_HOST`: IP-адрес или домен боевого сервера.
* `SSH_USER`: имя пользователя (например, `ubuntu` или `deploy`).
* `SSH_PRIVATE_KEY`: приватный SSH-ключ для беспарольного доступа.
