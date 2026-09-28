# Code Runner Service (`apps/code-runner`)

Сервис безопасного выполнения пользовательского кода во время Live Coding-интервью. Написан на **Go 1.26**, сам код не исполняет — делегирует это **Judge0 CE**, готовому движку песочницы поверх `isolate`.

---

## 1. Назначение и стек

* **Язык:** Go 1.26 (go.mod: `go 1.26.6`)
* **HTTP Router:** `github.com/go-chi/chi/v5`
* **Движок песочницы:** Judge0 CE 1.13.1 (REST API)
* **Поддерживаемые языки:** JavaScript, TypeScript, Python, Go, C++, Java

Сервис не имеет собственной БД и состояния: это stateless-прослойка между внутренним потребителем и Judge0.

---

## 2. Архитектура сервиса

```text
apps/code-runner/
├── cmd/
│   └── server/
│       └── main.go           # Точка входа, конфигурация, graceful shutdown
├── internal/
│   ├── config/               # Загрузка и валидация переменных окружения, лимиты
│   ├── judge0/               # Адаптер к Judge0: submission, поллинг, /languages
│   ├── runner/               # Домен: валидация, пул запусков, маппинг статусов
│   ├── handler/              # HTTP: POST /api/v1/run, /healthz, /readyz
│   └── middleware/           # Проверка общего секрета X-Internal-Token
├── go.mod
└── Dockerfile
```

Слой `judge0` ничего не знает о доменных статусах сервиса и отдаёт сырой ответ Judge0; трансляция в контракт API живёт в `runner`. Это граница, по которой движок песочницы можно заменить, не трогая HTTP-контракт.

---

## 3. Поток выполнения запроса

```text
внутренний потребитель
        │  POST /api/v1/run  (X-Internal-Token)
        ▼
┌──────────────────────────────────────────────┐
│ code-runner                                  │
│  1. Валидация: язык, размер кода/stdin,      │
│     потолок таймаута                         │
│  2. Слот в пуле (RUN_MAX_CONCURRENT)         │
│  3. Перевод лимитов в единицы Judge0         │
└───────────────────┬──────────────────────────┘
                    │  POST /submissions?base64_encoded=true&wait=false
                    ▼
        ┌───────────────────────┐
        │   judge0-server       │──► judge0-db    (submissions)
        │   (Rails API)         │──► judge0-redis (очередь resque)
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   judge0-workers      │  isolate: namespaces, cgroups, chroot
        └───────────┬───────────┘
                    │  результат в judge0-db
                    ▼
        GET /submissions/{token}  ◄── поллинг из code-runner
                    │
                    ▼
┌──────────────────────────────────────────────┐
│  4. Маппинг статуса Judge0 → статус API      │
│  5. Обрезка stdout/stderr до лимита          │
└──────────────────────────────────────────────┘
```

Судейство асинхронное: `POST /submissions` возвращает токен, а не результат. Синхронный режим Judge0 (`wait=true`) намеренно не используется — он занимает Rails-воркер на всё время выполнения и не рекомендован в production. Общий бюджет ожидания ограничен `JUDGE0_RESULT_TIMEOUT_MS`.

---

## 4. Контракт API

Сервис внутренний: наружу не публикуется, внутри docker-сети доступен по адресу `http://code-runner:8090`.

| Метод | Путь | Назначение |
| :--- | :--- | :--- |
| `POST` | `/api/v1/run` | Выполнение кода |
| `GET` | `/api/v1/languages` | Список поддерживаемых языков |
| `GET` | `/healthz` | Liveness: процесс жив |
| `GET` | `/readyz` | Readiness: доступность Judge0 (503 при недоступности) |

### 4.1. Запрос

```json
{
  "language": "typescript",
  "code": "const sum = (a: number, b: number): number => a + b;\nconsole.log(sum(5, 7));",
  "stdin": "",
  "timeoutMs": 3000
}
```

`language` нечувствителен к регистру и принимает алиасы: `js`/`node`/`nodejs` → `javascript`, `ts` → `typescript`, `py`/`python3` → `python`, `c++` → `cpp`, `golang` → `go`. `stdin` и `timeoutMs` необязательны.

### 4.2. Ответ

```json
{
  "status": "SUCCESS",
  "stdout": "12\n",
  "stderr": "",
  "exitCode": 0,
  "executionTimeMs": 142,
  "memoryUsageBytes": 34521000
}
```

### 4.3. Статусы выполнения

| `status` | Когда возвращается |
| :--- | :--- |
| `SUCCESS` | Код отработал и вернул `0` |
| `RUNTIME_ERROR` | Ненулевой код возврата или необработанное исключение |
| `COMPILATION_ERROR` | Ошибка компиляции; вывод компилятора переносится в `stderr` |
| `TIME_LIMIT_EXCEEDED` | Процесс снят по таймауту CPU или wall-time |
| `MEMORY_LIMIT_EXCEEDED` | Превышен лимит памяти |
| `OUTPUT_LIMIT_EXCEEDED` | Вывод обрезан по `RUN_MAX_OUTPUT_BYTES` |
| `INTERNAL_ERROR` | Сбой самого Judge0 (в т.ч. неверно настроенные cgroups) |

**Неудачное выполнение кода — не ошибка HTTP.** Упавшая программа и не скомпилировавшийся код возвращаются с `200 OK`, причина лежит в `status`. Потребитель должен показывать это в консоли редактора, а не ловить как исключение.

У Judge0 нет отдельного статуса для превышения памяти: `isolate` снимает процесс сигналом и отдаёт Runtime Error. `MEMORY_LIMIT_EXCEEDED` распознаётся по фактическому пику потребления и тексту `message`.

### 4.4. Коды ответа

| Код | Причина |
| :--- | :--- |
| `200` | Запуск выполнен (в т.ч. с ошибкой в коде пользователя) |
| `400` | Неизвестный язык, пустой код, превышен размер кода/stdin, `timeoutMs` выше потолка |
| `401` | Отсутствует или неверен `X-Internal-Token` |
| `413` | Тело запроса больше допустимого |
| `429` | Пул запусков занят, слот не освободился за `RUN_QUEUE_WAIT_MS` |
| `502` | Judge0 недоступен или вернул ошибку |
| `504` | Judge0 не отдал финальный статус за `JUDGE0_RESULT_TIMEOUT_MS` |

---

## 5. Лимиты и безопасность

| Параметр | Переменная | По умолчанию | Поведение при превышении |
| :--- | :--- | :--- | :--- |
| Таймаут CPU | `RUN_DEFAULT_TIMEOUT_MS` | `3000` | `TIME_LIMIT_EXCEEDED` |
| Потолок таймаута | `RUN_MAX_TIMEOUT_MS` | `5000` | `400 Bad Request` |
| Память | `RUN_MEMORY_LIMIT_KB` | `262144` (256 МБ) | `MEMORY_LIMIT_EXCEEDED` |
| Размер кода | `RUN_MAX_CODE_BYTES` | `65536` (64 КБ) | `400 Bad Request` |
| Размер stdin | `RUN_MAX_STDIN_BYTES` | `65536` (64 КБ) | `400 Bad Request` |
| Размер stdout/stderr | `RUN_MAX_OUTPUT_BYTES` | `65536` (64 КБ) | Обрезка с пометкой `[output truncated]` |
| Файлы в песочнице | `RUN_MAX_FILE_SIZE_KB` | `4096` | Ошибка записи внутри песочницы |
| Процессы и потоки | `RUN_MAX_PROCESSES` | `64` | Защита от fork-бомбы |
| Одновременных запусков | `RUN_MAX_CONCURRENT` | `32` | `429` после `RUN_QUEUE_WAIT_MS` |
| Сеть в песочнице | — | отключена | Судейство идёт с `enable_network: false` |

Лимит `RUN_MAX_FILE_SIZE_KB` ограничивает не вывод, а артефакты сборки: бинарь Go занимает единицы мегабайт, и 64 КБ здесь сломали бы компиляцию. Обрезка вывода выполняется отдельно, уже на стороне сервиса.

Память по умолчанию взята по верхней границе диапазона из ТЗ (256 МБ): на 128 МБ не стартуют JVM и рантайм Go даже на тривиальных программах.

### Аутентификация

Все запросы, кроме проб, требуют заголовок `X-Internal-Token` со значением `CODE_RUNNER_AUTH_TOKEN`. Сравнение идёт за константное время. Пустое значение отключает проверку — это режим локальной разработки; **в production сервис с пустым токеном не стартует** (fail-closed в `internal/config`).

### Изоляция

Изоляцию обеспечивает `isolate` внутри Judge0: namespaces, chroot, непривилегированные пользователи, cgroups, отключённая сеть. Контейнеры `judge0-server` и `judge0-workers` работают с `privileged: true` — это требование `isolate`, которому нужно создавать namespaces и cgroups.

API Judge0 публикуется только на `127.0.0.1`. Наружу его выставлять нельзя: в версиях до 1.13.1 были уязвимости с побегом из песочницы (CVE-2024-28185, CVE-2024-28189, CVE-2024-29021).

---

## 6. Соответствие языков

`language_id` заданы для стандартной поставки Judge0 CE 1.13.1. На старте сервис сверяет их с `GET /languages` и пишет предупреждение при расхождении — без такой сверки запрос ушёл бы на чужой рантайм.

| Язык | `language_id` | Рантайм в Judge0 |
| :--- | :--- | :--- |
| `javascript` | `93` | Node.js 18.15.0 |
| `typescript` | `94` | TypeScript 5.0.3 |
| `python` | `92` | Python 3.11.2 |
| `go` | `95` | Go 1.18.5 |
| `cpp` | `54` | C++ (GCC 9.2.0) |
| `java` | `91` | Java (JDK 17.0.6) |

Переопределяются через `JUDGE0_LANGUAGE_IDS` без пересборки образа, формат `python=92,go=95`. Пустое значение убирает язык из поддерживаемых: `JUDGE0_LANGUAGE_IDS=java=` отключит Java.

---

## 7. Конфигурация

| Переменная | По умолчанию | Назначение |
| :--- | :--- | :--- |
| `CODE_RUNNER_PORT` | `8090` | Порт HTTP-сервера |
| `CODE_RUNNER_HOST` | `0.0.0.0` | Интерфейс прослушивания |
| `CODE_RUNNER_AUTH_TOKEN` | — | Общий секрет для внутренних вызовов |
| `JUDGE0_URL` | `http://localhost:2358` | Адрес API Judge0 |
| `JUDGE0_AUTH_HEADER` | `X-Auth-Token` | Заголовок авторизации Judge0 |
| `JUDGE0_AUTH_TOKEN` | — | Токен Judge0 |
| `JUDGE0_REQUEST_TIMEOUT_MS` | `10000` | Таймаут одного HTTP-запроса к Judge0 |
| `JUDGE0_RESULT_TIMEOUT_MS` | `30000` | Общий бюджет ожидания результата |
| `JUDGE0_POLL_INITIAL_DELAY_MS` | `50` | Пауза перед первым опросом |
| `JUDGE0_POLL_INTERVAL_MS` | `100` | Интервал опроса |
| `JUDGE0_LANGUAGE_IDS` | — | Переопределение `language_id` |

Лимиты выполнения — в таблице раздела 5. Полный список с комментариями — в [`.env.example`](../../../.env.example).

`WRITE_TIMEOUT_SECONDS` поднимается автоматически, если он меньше суммы бюджета ожидания результата и времени в очереди: запрос остаётся открытым всё время выполнения, и при коротком write-таймауте сервер разорвал бы соединение раньше, чем отдал готовый результат.

---

## 8. Локальный запуск

Профиль поднимает сервис вместе со всем стеком Judge0 — API-сервер, пул воркеров, собственные Postgres и Redis:

```bash
docker compose --env-file .env --profile code-runner up -d --build
```

Или через скрипты монорепозитория:

```bash
pnpm code-runner:up
pnpm code-runner:logs
pnpm code-runner:down
```

Проверка:

```bash
curl -s -X POST localhost:8090/api/v1/run -H 'Content-Type: application/json' -d '{"language":"python","code":"print(2+2)"}'
```

Собственные Postgres и Redis у Judge0 отдельные от основных не случайно: Judge0 владеет своей схемой и гоняет собственные Rails-миграции, а его очередь resque имеет профиль нагрузки, не совместимый с настройками основного Redis (`maxmemory-policy noeviction`).

### Требование к хосту: cgroup v1

Judge0 1.13.1 сэндбоксит через `isolate` 1.8, который поддерживает только cgroup v1. Проверка хоста:

```bash
stat -fc %T /sys/fs/cgroup
```

* `tmpfs` — cgroup v1, всё работает;
* `cgroup2fs` — контейнеры поднимутся и будут выглядеть здоровыми, но каждый запуск кода вернёт `INTERNAL_ERROR`, а в логах `judge0-workers` будет `Failed to create control group`.

На Linux лечится разовой правкой GRUB (`GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"`) и перезагрузкой. **На Docker Desktop (Windows/macOS) не лечится**: контейнеры живут в служебном VM с cgroup v2, который не переключается.

---

## 9. Тестирование

```bash
pnpm test:code-runner
# или: cd apps/code-runner && go test ./...
```

Тесты `internal/runner` поднимают HTTP-сервер, повторяющий контракт Judge0, и гоняют через него реальный клиент адаптера: успешный запуск, ошибка компиляции, таймаут, превышение памяти, обрезка вывода, валидация. Judge0 для их запуска не нужен.
