# Code Runner Service (Go + Judge0)

Сервис безопасного выполнения кода кандидата во время Live Coding-интервью платформы **MockInterviewAI**. Принимает исходник, гоняет его в одноразовой песочнице Judge0 и возвращает `stdout`, `stderr`, код возврата, время и память.

Архитектура, лимиты и внутреннее устройство — [docs/backend/architecture/code-runner.md](../../docs/backend/architecture/code-runner.md).

---

## 📌 1. Подключение (Connection Guide)

Сервис **внутренний**: во внешнюю сеть не публикуется — порт 8090 привязан к loopback хоста.

* **Внутри Docker-сети:** `http://code-runner:8090`
* **С хоста (локальная разработка):** `http://localhost:8090`

### Аутентификация

Все запросы, кроме проб `/healthz` и `/readyz`, требуют общий секрет в заголовке:

```http
X-Internal-Token: <CODE_RUNNER_AUTH_TOKEN>
```

Пустой `CODE_RUNNER_AUTH_TOKEN` отключает проверку — это режим локальной разработки. В production сервис с пустым токеном **не стартует**: он исполняет произвольный код и не должен быть вызываемым анонимно.

---

## 2. Эндпоинты

| Метод | Путь | Назначение |
| :--- | :--- | :--- |
| `POST` | `/api/v1/run` | Выполнение кода |
| `GET` | `/api/v1/languages` | Список поддерживаемых языков |
| `GET` | `/healthz` | Liveness |
| `GET` | `/readyz` | Readiness (503, если Judge0 недоступен) |

### `POST /api/v1/run`

```json
{
  "language": "typescript",
  "code": "console.log(5 + 7);",
  "stdin": "",
  "timeoutMs": 3000
}
```

| Поле | Обязательно | Описание |
| :--- | :--- | :--- |
| `language` | да | `javascript`, `typescript`, `python`, `go`, `cpp`, `java`. Регистр не важен, принимаются алиасы (`js`, `ts`, `py`, `c++`, `golang`) |
| `code` | да | Исходный код, до 64 КБ |
| `stdin` | нет | Ввод программы, до 64 КБ |
| `timeoutMs` | нет | По умолчанию `3000`, потолок `5000` |

Ответ:

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

---

## 3. Обработка ответа на стороне клиента

**Упавший код пользователя — не ошибка HTTP.** Программа с исключением или не прошедшая компиляцию возвращается с `200 OK`, а причина лежит в поле `status`. Это надо показывать в консоли редактора, а не ловить как исключение.

| `status` | Что показать пользователю |
| :--- | :--- |
| `SUCCESS` | `stdout` |
| `RUNTIME_ERROR` | `stderr` — исключение или ненулевой код возврата |
| `COMPILATION_ERROR` | `stderr` — вывод компилятора |
| `TIME_LIMIT_EXCEEDED` | Превышен лимит времени |
| `MEMORY_LIMIT_EXCEEDED` | Превышен лимит памяти |
| `OUTPUT_LIMIT_EXCEEDED` | `stdout` обрезан, в конце пометка `[output truncated]` |
| `INTERNAL_ERROR` | Сбой песочницы — не вина пользователя, стоит предложить повтор |

Как ошибку обрабатываются только не-`2xx` коды:

| Код | Причина | Что делать |
| :--- | :--- | :--- |
| `400` | Неизвестный язык, пустой код, превышен размер, `timeoutMs` выше потолка | Показать сообщение из поля `error` |
| `401` | Нет или неверен `X-Internal-Token` | Ошибка конфигурации сервиса-потребителя |
| `413` | Тело запроса слишком большое | Показать сообщение пользователю |
| `429` | Пул запусков занят | Повторить позже |
| `502` / `504` | Judge0 недоступен или не успел | Повторить позже |

Тело ошибки: `{ "error": "..." }`.

---

## 4. Локальный запуск

```bash
# Сервис + весь стек Judge0 (API-сервер, воркеры, своя Postgres и Redis)
pnpm code-runner:up
pnpm code-runner:logs
pnpm code-runner:down
```

Проверка:

```bash
curl -s -X POST localhost:8090/api/v1/run -H 'Content-Type: application/json' -d '{"language":"python","code":"print(2+2)"}'
```

> **Требуется хост на cgroup v1.** Judge0 1.13.1 сэндбоксит через `isolate` 1.8, который cgroup v2 не поддерживает. Проверка: `stat -fc %T /sys/fs/cgroup` → `tmpfs` (ок) или `cgroup2fs` (запуски будут возвращать `INTERNAL_ERROR`). На Docker Desktop под Windows/macOS не обходится — там служебный VM на cgroup v2. Подробности — в [docs/devops/infrastructure/local-docker.md](../../docs/devops/infrastructure/local-docker.md).

Если Judge0 уже развёрнут отдельно, локальный стек не нужен — достаточно указать `JUDGE0_URL` на внешний инстанс.

---

## 5. Разработка

```bash
# Нативный запуск (нужен Go 1.26+ и доступный Judge0)
pnpm dev:code-runner
# или: cd apps/code-runner && go run ./cmd/server

# Тесты и линтер
pnpm test:code-runner
pnpm lint:code-runner
```

Тесты `internal/runner` поднимают HTTP-сервер, повторяющий контракт Judge0, и прогоняют через него реальный клиент адаптера — сам Judge0 для их запуска не нужен.

Переменные окружения и лимиты описаны в [`.env.example`](../../.env.example), раздел `Code Runner + Judge0`.
