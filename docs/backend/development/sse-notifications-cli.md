# CLI Утилита отправки SSE-уведомлений (`scripts/send-sse.mjs`)

Утилита командной строки для эмуляции, тестирования и отправки событий реального времени в сервис **`apps/realtime`** через **Redis Streams** и **Redis Pub/Sub**.

Позволяет фронтенд- и бэкенд-разработчикам моментально тестировать всплывающие уведомления (Toast), колокольчик уведомлений, инвайты в комнаты интервью, статусы AI-отчетов и общесистемные алерты без необходимости выполнять реальные действия в базе данных или запускать тяжелые сценарии.

---

## 🚀 Быстрый старт

Убедитесь, что поднят Redis (`pnpm infra:up`) и запущен сервис `realtime` (`pnpm realtime:up` или `pnpm dev:realtime`).

```bash
# 1. Отправить тестовое персональное уведомление:
pnpm sse:send --user dev-user-1 --title "Новое интервью" --message "Вас ожидают в комнате"

# 2. Отправить приглашение на собеседование (быстрый пресет):
pnpm sse:send --user dev-user-1 --interview

# 3. Обновить счетчик непрочитанных на колокольчике:
pnpm sse:send --user dev-user-1 --badge 5

# 4. Отправить общесистемный алерт всем подключенным пользователям (Broadcast):
pnpm sse:broadcast --message "Сервер будет перезагружен через 10 минут"

# 5. Запустить интерактивный пошаговый мастер:
pnpm sse:send -i
```

---

## 🛠️ Как это работает под капотом

Сервис `apps/realtime` реализует архитектуру распределенной доставки уведомлений:

```
                          [ scripts/send-sse.mjs ]
                                     |
                 +-------------------+-------------------+
                 |                                       |
    (Персональное уведомление)               (Общесистемный broadcast)
                 v                                       v
      [ Redis Stream (XADD) ]                 [ Redis Pub/Sub ]
   user:{userId}:notifications              notifications:broadcast
                 |                                       |
                 +-------------------+-------------------+
                                     |
                                     v
                           [ apps/realtime (SSE) ]
                            GET /sse/notifications
                                     |
                                     v
                         [ Frontend (EventSource) ]
```

1. **Персональные уведомления (`user:{userId}:notifications`)**:
   - Записываются командой `XADD` с автоматическим ограничением глубины `MAXLEN ~ 100`.
   - Продлевается TTL ключа стрима на 7 суток.
   - Поддерживают фазу **Replay** (доставка пропущенных событий после разрыва связи по заголовку `Last-Event-ID`).
2. **Общесистемные алерты (`notifications:broadcast`)**:
   - Публикуются в канал Redis Pub/Sub `notifications:broadcast`.
   - Мгновенно доставляются всем нодам кластера `realtime` и рассылаются всем активным соединениям.

---

## 📋 Справочник параметров и флагов

| Флаг | Короткий | Значение по умолчанию | Описание |
| :--- | :---: | :--- | :--- |
| `--user <id>` | `-u` | `dev-user-1` | ID пользователя-получателя (ключ стрима `user:{id}:notifications`). |
| `--type <type>` | `-t` | `notification.new` | Тип события SSE (`notification.new`, `notification.badge`, `interview.invite`, `ai.report.ready`, и т.д.). |
| `--category <cat>` | `-c` | `SYSTEM` | Категория уведомления: `SYSTEM`, `INTERVIEW`, `MESSAGE`, `info`, `warning`, `error`, `success`. |
| `--title <title>` | | `Тестовое уведомление` | Заголовок уведомления. |
| `--message <text>`| `-m` | `...` | Текст сообщения уведомления. |
| `--action-url <url>`| `-a` | `null` | URL перехода при клике на уведомление (например, `/sessions/session-123`). |
| `--badge <count>` | | `null` | Отправить обновление счетчика (автоматически выставляет `--type notification.badge`). |
| `--broadcast` | `-b` | `false` | Опубликовать в глобальный Pub/Sub канал `notifications:broadcast` (автоматически выставляет `--type system.broadcast`). |
| `--tls` | | `false` | Использовать TLS-шифрование при подключении к Redis (`rediss://` / `REDIS_TLS=true`). |
| `--insecure` | | `false` | Разрешить подключение к удаленному Redis без TLS (отключение проверки CWE-319, не рекомендуется). |
| `--raw <json>` | | `null` | Передать собственный кастомный JSON payload. |
| `--interactive` | `-i` | `false` | Пошаговый консольный мастер с подсказками. |
| `--help` | `-h` | | Вывести справку по командам. |

---

## ⚡ Готовые шаблоны (Пресеты)

Для часто используемых сценариев предусмотрены флаги-пресеты:

| Флаг пресета | Тип (`type`) | Категория (`category`) | Описание сценария |
| :--- | :--- | :--- | :--- |
| `--interview` | `notification.new` | `INTERVIEW` | Приглашение кандидата на техническое собеседование с ссылкой на сессию. |
| `--system` | `notification.new` | `SYSTEM` | Системное уведомление о технических работах или обновлении платформы. |
| `--message-preset`| `notification.new` | `MESSAGE` | Новое сообщение в чате сессии интервью. |
| `--ai-report` | `ai.report.ready` | `SYSTEM` | Событие завершения генерации AI-отчета с ссылкой на аналитику. |
| `--code-run` | `code.run.completed`| `SYSTEM` | Результат запуска тестов в сервисе code-runner. |

---

## 💡 Примеры типовых сценариев использования

### 1. Тестирование всплывающего инвайта на интервью (с ссылкой)
```bash
pnpm sse:send --user user-42 --category INTERVIEW --title "Собеседование готово" --message "Интервьюер ждет вас в комнате" --action-url "/sessions/interview-888"
```

### 2. Тестирование колокольчика и бейджа непрочитанных
```bash
# Установить на счетчике 3:
pnpm sse:send --user user-42 --badge 3

# Сбросить счетчик:
pnpm sse:send --user user-42 --badge 0
```

### 3. Эмуляция готовности отчета ИИ
```bash
pnpm sse:send --user user-42 --ai-report --action-url "/reports/dev-session-1"
```

### 4. Тестирование с произвольным JSON payload
```bash
pnpm sse:send --user user-42 --type custom.event --raw '{"codeState":{"lines":150},"status":"passed"}'
```

### 5. Отправка общесистемного алерта (Broadcast)
```bash
# Быстрая команда (автоматически использует --type system.broadcast):
pnpm sse:broadcast --message "Технические работы через 10 минут"

# Или через sse:send с явным указанием флага:
pnpm sse:send --broadcast --type system.broadcast --message "Сервер будет перезагружен через 10 минут"
```

---

## 🔍 Подключение к SSE на клиенте (Frontend)

Для проверки получения событий в браузере или компоненте:

```typescript
const eventSource = new EventSource("http://localhost:8080/sse/notifications", {
  withCredentials: true,
});

// Слушаем обычные уведомления в шторку:
eventSource.addEventListener("notification.new", (event) => {
  const data = JSON.parse(event.data);
  console.log("Новое уведомление:", data.title, data.message);
});

// Слушаем счетчик на колокольчике:
eventSource.addEventListener("notification.badge", (event) => {
  const data = JSON.parse(event.data);
  console.log("Непрочитанных:", data.unreadCount);
});

// Слушаем общесистемные алерты:
eventSource.addEventListener("system.broadcast", (event) => {
  const data = JSON.parse(event.data);
  console.log("Системный алерт:", data.message);
});
```

---

## 🛠️ Возможные проблемы и их решение

1. **`❌ Не удалось подключиться к Redis (localhost:6379)`**:
   - Убедитесь, что Redis запущен в Docker: выполните `pnpm infra:up`.
2. **`❌ Ошибка: пакет ioredis не найден`**:
   - Выполните `pnpm install` в корне монорепозитория.
3. **Уведомление отправлено, но браузер его не видит**:
   - Проверьте `userID`: ID пользователя в токене авторизации клиента должен совпадать с флагом `--user <id>`.
   - Проверьте статус сервиса realtime: `pnpm realtime:logs`.
