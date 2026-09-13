# Техническое задание: Сервис безопасного выполнения кода (apps/code-runner)

Данный документ содержит полное описание архитектуры, требований безопасности, спецификации API и плана реализации сервиса **`apps/code-runner`** для платформы **MockInterviewAI**.

---

## 1. Назначение сервиса

Сервис **`apps/code-runner`** предназначен для безопасного, изолированного и быстрого выполнения пользовательского кода в реальном времени во время технических собеседований (Live Coding).

### Поддерживаемые языки программирования:
* **JavaScript / TypeScript** (Node.js 20+)
* **Python 3** (Python 3.12+)
* **Go** (Golang 1.22+)
* **C++** (GCC / Clang C++20)
* **Java** (OpenJDK 21)

---

## 2. Архитектура и изоляция (Sandbox & Security)

Каждый запуск пользовательского кода выполняется в изолированной одноразовой песочнице с жесткими ограничениями ресурсов, чтобы исключить DoS-атаки, майнинг, утечки данных и повреждение хост-системы.

```mermaid
flowchart TD
    subgraph Client ["Клиенты"]
        Web["apps/web (Monaco Editor)"]
        Realtime["apps/realtime / apps/api"]
    end

    subgraph Service ["apps/code-runner (HTTP / gRPC)"]
        API["REST API Router (POST /run)"]
        Validator["Валидатор размера и языка"]
        Queue["Очередь задач / Worker Pool"]
        Sanitizer["Output Sanitizer (Max 64KB)"]
    end

    subgraph Sandbox ["Изолированная среда (Docker / nsjail / tmpfs)"]
        Container["Sandbox Container (--network none, read-only)"]
        Limits["Ограничения: CPU: 2s, RAM: 128MB, No Root"]
    end

    Web -->|1. Запрос на запуск кода| Realtime
    Realtime -->|2. POST /run| API
    API --> Validator
    Validator --> Queue
    Queue -->|3. Spawn изолированного процесса| Container
    Container --> Limits
    Limits -->|4. Результат (stdout, stderr, exitCode, time)| Sanitizer
    Sanitizer --> API
    API -->|5. Результат выполнения| Realtime
    Realtime -->|6. Вывод в консоль редактора| Web
```

---

## 3. Политики безопасности и ограничения ресурсов (Hard Limits)

| Параметр | Лимит | Поведение при превышении |
| :--- | :--- | :--- |
| **CPU Time Limit** | **2–5 секунд** | Принудительный `SIGKILL`, статус `TIME_LIMIT_EXCEEDED` |
| **Memory Limit (RAM)** | **128–256 МБ** | OOM Killer, статус `MEMORY_LIMIT_EXCEEDED` |
| **Макс. размер кода** | **64 КБ** | Отклонение запроса с `400 Bad Request` |
| **Макс. размер stdout/stderr** | **64 КБ** | Обрезка вывода с пометкой `[output truncated...]` |
| **Сетевой доступ** | **Полностью отключен (`--network none`)** | Запрещены любые исходящие и входящие сетевые соединения |
| **Файловая система** | **Read-Only Root + временный `tmpfs` (20 МБ)** | Запрет модификации системных файлов |
| **Привилегии** | **Non-root (UID 1000), `no-new-privileges`** | Отключены все Linux capabilities (`--cap-drop ALL`) |
| **Fork-bomb защита** | **PIDs Limit: макс. 64 процесса** | Запрет создания неконтролируемого количества потоков |

---

## 4. Контракты API (Спецификация)

Базовый эндпоинт: `POST /api/v1/run`

### 4.1. Формат входных данных (Request Body)
```json
{
  "language": "typescript",
  "code": "const sum = (a: number, b: number): number => a + b;\nconsole.log(sum(5, 7));",
  "stdin": "",
  "timeoutMs": 3000
}
```

### 4.2. Формат ответа (Response Body)
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

### Возможные статусы (`status`):
* `SUCCESS` — код успешно выполнился и вернул код `0`.
* `RUNTIME_ERROR` — ошибка во время выполнения (ненулевой код возврата или необработанный Exception).
* `COMPILATION_ERROR` — ошибка компиляции (для Go, C++, Java, TypeScript).
* `TIME_LIMIT_EXCEEDED` — выполнение прервано по таймауту.
* `MEMORY_LIMIT_EXCEEDED` — превышен лимит оперативной памяти.
* `OUTPUT_LIMIT_EXCEEDED` — вывод превысил максимальный допустимый размер.

---

## 5. Задачи по реализации

### 1. Архитектура и базовая структура (`apps/code-runner`):
- [ ] Инициализировать сервис в `apps/code-runner` (Go или Node.js/TypeScript).
- [ ] Настроить HTTP-сервер с эндпоинтом `POST /api/v1/run` и `GET /health`.
- [ ] Настроить graceful shutdown и пул воркеров для параллельного выполнения.

### 2. Рантаймы и среды выполнения:
- [ ] Подготовить легковесные базовые образы / окружения компиляторов и интерпретаторов:
  - Node.js (TypeScript через `tsx` / `esbuild`)
  - Python 3
  - Go
  - C++ (g++)
  - Java
- [ ] Реализовать менеджер выполнения с замером времени и потребления памяти.

### 3. Механизмы безопасности:
- [ ] Настроить изоляцию (`--network none`, read-only fs, pids-limit, no-new-privileges).
- [ ] Реализовать тайм-аут сторож (Watchdog timer) с отправкой `SIGKILL`.
- [ ] Реализовать санитизацию и обрезку вывода stdout/stderr до 64 КБ.

### 4. Интеграция в монорепозиторий и CI/CD:
- [ ] Добавить сервис в `docker-compose.yml` (dev) и `docker-compose.prod.yml` (prod).
- [ ] Настроить скрипты сборки и тестов в `package.json` / Turborepo.
- [ ] Добавить переменные окружения в `.env.example`.

### 5. Тестирование:
- [ ] Тесты выполнения базовых программ для каждого языка (Hello World, циклы, ввод-вывод).
- [ ] Тесты компиляционных ошибок и рантайм-исключений.
- [ ] Тесты безопасности (Security / Exploit Tests):
  - Попытка бесконечного цикла (проверка `TIME_LIMIT_EXCEEDED`).
  - Попытка fork bomb (проверка лимита процессов).
  - Попытка сетевого запроса (проверка блокировки сети).
  - Попытка записи в системные директории (проверка read-only fs).

---

## 6. Критерии приемки (Definition of Done)

- [ ] Сервис успешно запускается локально и в Docker.
- [ ] Эндпоинт `POST /api/v1/run` выполняет код на JS/TS, Python, Go, C++, Java менее чем за 500мс для простых скриптов.
- [ ] Все лимиты безопасности (CPU, RAM, Network, PIDs, Read-only FS) строго соблюдаются и протестированы.
- [ ] Все тесты проходят успешно (`pnpm test:code-runner`).
