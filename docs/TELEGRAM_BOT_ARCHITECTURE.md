# Архитектура сервиса Telegram-бота (apps/telegram-bot)

Данный документ описывает архитектуру отдельного сервиса Telegram-бота, его интеграцию с бэкеном (`apps/api`), брокером сообщений (`RabbitMQ`), системой локализации (`@packages/i18n`) и клиентским приложением (`apps/web`).

---

## 1. Назначение и ключевые цели

Сервис **`apps/telegram-bot`** выполняет роль персонального ассистента пользователя платформы **MockInterviewAI** в Telegram:
1. **Мгновенная доставка уведомлений**: напоминания о предстоящих собеседованиях (за 1 час и 15 минут), приглашения в сессии, уведомления о фидбеке и оценках.
2. **Интерактивное управление**: просмотр запланированных сессий (`/interviews`), прямые ссылки на переход в комнату собеседования.
3. **Управление профилем и подпиской**: привязка/отвязка аккаунта (`/start <token>`, `/unlink`), статус (`/me`).
4. **Управление настройками**: включение/отключение категорий уведомлений прямо из Telegram (`/settings`).
5. **Мультиязычность**: автоматическая адаптация под язык клиента Telegram или профиля пользователя (`ru` / `en`) на базе `@packages/i18n`.

---

## 2. Архитектурная диаграмма и принципы изоляции

Сервис `apps/telegram-bot` **полностью изолирован от базы данных PostgreSQL**. Вся работа с данными и бизнес-логика сосредоточены в `apps/api`.

```mermaid
flowchart TD
    subgraph WebApp ["apps/web (Frontend)"]
        LinkUI["Кнопка 'Подключить Telegram'"]
        NotifPrefs["Настройки уведомлений в ЛК"]
    end

    subgraph BackendAPI ["apps/api (NestJS API & Business Logic)"]
        NotifService["NotificationsService"]
        TgInternalCtrl["TelegramInternalController (/api/v1/telegram/*)"]
        MQProducer["RabbitMQ Producer"]
        PrismaDB[("PostgreSQL (Prisma)")]
    end

    subgraph Broker ["RabbitMQ Broker"]
        QueueNotif["Очередь: telegram.notifications"]
        QueueDeadLetter["Очередь: telegram.notifications.dlq"]
    end

    subgraph BotService ["apps/telegram-bot (TypeScript / grammY)"]
        MQConsumer["RabbitMQ Consumer"]
        TgHandlers["Command & Callback Handlers"]
        I18nLib["@packages/i18n (ru/en)"]
    end

    subgraph TelegramAPI ["Telegram Cloud API"]
        TgServer["Telegram Bot API"]
        EndUser["Пользователь в Telegram"]
    end

    LinkUI -->|1. Запрос ссылки на привязку| TgInternalCtrl
    TgInternalCtrl -->|2. Генерация токена (TTL 15m)| PrismaDB
    TgInternalCtrl -->|3. t.me/Bot?start=TOKEN| LinkUI
    
    LinkUI -.->|4. Переход по ссылке| EndUser
    EndUser -->|5. /start TOKEN| TgServer
    TgServer -->|6. Updates / Webhook| TgHandlers

    TgHandlers -->|7. POST /api/v1/telegram/link| TgInternalCtrl
    TgInternalCtrl -->|8. Сохранение telegramChatId| PrismaDB
    TgHandlers -->|9. Тексты из @packages/i18n| I18nLib

    NotifService -->|10. Новое уведомление| MQProducer
    MQProducer -->|11. Publish event| QueueNotif
    QueueNotif -->|12. Consume event| MQConsumer
    MQConsumer -->|13. sendMessage| TgServer
    TgServer -->|14. Доставка пуша| EndUser

    TgHandlers -->|15. GET /interviews| TgInternalCtrl
    TgInternalCtrl -->|16. Выборка сессий| PrismaDB
```

---

## 3. Модели взаимодействия

### 3.1. Push-поток (Отправка уведомлений)
1. В `apps/api` при наступлении события (создание сессии, крон-напоминание за 15 минут, системное оповещение) `NotificationsService` проверяет, привязан ли у пользователя `telegramChatId` и включен ли данный тип уведомлений.
2. `apps/api` публикует компактное событие в очередь RabbitMQ `telegram.notifications`.
3. `apps/telegram-bot` слушает очередь, получает сообщение, форматирует текст в соответствии с локалью пользователя через `@packages/i18n` и вызывает Telegram Bot API.
4. В случае временной ошибки (например, сетевой сбой или Telegram Rate Limit 429), сообщение отправляется на повтор с экспоненциальной задержкой либо уходит в DLQ (Dead Letter Queue).

#### Формат payload в RabbitMQ:
```typescript
export interface TelegramNotificationMessage {
  telegramChatId: string;
  locale: 'ru' | 'en';
  type: 'INTERVIEW_REMINDER' | 'SESSION_INVITE' | 'FEEDBACK_READY' | 'SYSTEM_ALERT';
  data: {
    sessionId?: string;
    interviewTitle?: string;
    scheduledAt?: string;
    role?: 'CANDIDATE' | 'INTERVIEWER';
    actionUrl?: string;
    [key: string]: unknown;
  };
}
```

---

### 3.2. Request-Response поток (Интерактивные действия пользователя)
Когда пользователь отправляет боту команду или нажимает Inline-кнопку:
1. `apps/telegram-bot` перехватывает событие (через Long Polling в dev / Webhook в prod).
2. Бот выполняет HTTP-запрос к `apps/api` по внутреннему REST API, передавая `telegramChatId` и сервисный секретный ключ (`X-Internal-Service-Key`).
3. `apps/api` производит валидацию, работу с БД и возвращает результат в виде DTO.
4. Бот генерирует ответное сообщение с Inline-кнопками на нужном языке.

#### Внутренние эндпоинты `apps/api` (`/api/v1/telegram/*`):
* `POST /api/v1/telegram/link-token` — генерация одноразового токена привязки (вызывается из `apps/web` авторизованным пользователем).
* `POST /api/v1/telegram/link` — валидация токена и привязка `telegramChatId` к пользователю (вызывается из бота по `/start <token>`).
* `POST /api/v1/telegram/unlink` — отвязка Telegram-аккаунта.
* `GET /api/v1/telegram/profile?chatId={id}` — получение информации о пользователе по его `telegramChatId`.
* `GET /api/v1/telegram/interviews?chatId={id}` — получение списка предстоящих собеседований.
* `PATCH /api/v1/telegram/preferences` — обновление настроек уведомлений.

---

## 4. Локализация и интернационализация (@packages/i18n)

Все тексты для бота хранятся в общем пакете [`packages/i18n`](../packages/i18n):
* `packages/i18n/src/locales/ru/telegram.json`
* `packages/i18n/src/locales/en/telegram.json`

### Определение языка пользователя (приоритет):

Согласно `apps/telegram-bot/SPEC.md` §10.2 (актуальный порядок):

1. **Явный выбор `/lang`**: значение из сессии бота `ctx.session.locale`. Самый высокий приоритет.
2. **Язык профиля**: если аккаунт привязан и локаль задана, используется сохранённая локаль пользователя.
3. **Автоопределение**: `ctx.from.language_code` из Telegram API (префикс `ru` → `ru`, иначе → `en`; при отсутствии — fallback, default locale пакета).

---

## 5. Стек технологий сервиса

* **Язык / Рантайм:** TypeScript, Node.js >= 20.x
* **Telegram Bot Framework:** [`grammY`](https://grammy.dev/) (строгая типизация, плагины для меню, сессий и очередей)
* **Брокер сообщений:** `amqplib` / `amqp-connection-manager` (RabbitMQ)
* **Общие пакеты монорепозитория:** `@packages/i18n`, `@packages/dto`, `@packages/types`
* **Линтинг и форматирование:** Biome

---

## 6. Переменные окружения

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_BOT_USERNAME=MockInterviewBot
TELEGRAM_WEBHOOK_URL=https://api.mockinterview.ai/telegram/webhook # только для prod
TELEGRAM_WEBHOOK_SECRET=your-secret-webhook-key

# Internal API & Security
API_INTERNAL_URL=http://localhost:3001/api/v1
INTERNAL_SERVICE_KEY=change-me-internal-service-secret-key

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_QUEUE_NOTIFICATIONS=telegram.notifications

# Frontend URL (для формирования ссылок на сессии)
WEB_APP_URL=http://localhost:3000
```
