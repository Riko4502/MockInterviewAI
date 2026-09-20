# План исправления замечаний Code Review

Файл для отслеживания статуса исправления найденных проблем и архитектурных замечаний.

---

## 📋 Список задач

### 1. Realtime & SSE (Go Backend)

- [x] **1.1. Не скрывать ошибки `bufio.Scanner` в `awaitComment`**
  - **Описание:** `bufio.Scanner.Err()` возвращает `nil` при `io.EOF`, поэтому проверка `io.EOF` не требуется. При других ошибках сканирования тест должен завершаться с `t.Errorf`, не считая закрытие канала за успешное открытие SSE-потока. Игнорировать только `context.Canceled`.
  - **Файлы:** `apps/realtime/internal/handler/sse_test.go`

- [x] **1.2. Барьер v5: явное ожидание доставки в `sendCh`**
  - **Описание:** В тестах рассылки `codeSaveWorker` может сохранить версию раньше, чем room loop отправит конверты клиентам. Необходимо собирать конверты из `client.sendCh` в цикле с дедлайном (`time.After(2 * time.Second)`), пока не наберётся 5 или не истечёт время.
  - **Файлы:** `apps/realtime/internal/ws/room_order_test.go`

- [x] **1.3. Проверка порядка всех вызовов `SaveCodeState`**
  - **Описание:** Добавить отдельный журнал всех вызовов `SaveCodeState` в моках хранилища и проверять порядок версий в этом журнале, не изменяя состояние `savedCodes`, возвращаемое при `GetCodeState`.
  - **Файлы:** `apps/realtime/internal/ws/room_order_test.go`

- [x] **1.4. Убрать синхронный вызов Redis из цикла комнаты (`Room.Run`)**
  - **Описание:** `Room.Run` обрабатывает события в одной горутине и вызывает `handleBroadcast`, где синхронно вызывался `RedisStore.NextCodeVersion`. Выделение версий вынесено в отдельный последовательный воркер `codeUpdateWorker`, исключая блокировку главного цикла `Room.Run` на сетевом I/O к Redis.
  - **Файлы:** `apps/realtime/internal/ws/room.go`

---

### 2. DTO & Realtime Protocol Contracts

- [x] **2.1. Сделать `requestId` и `timestamp` обязательными в Realtime Envelope DTO**
  - **Описание:** В `BaseWebSocketEnvelope` поля `requestId: string` и `timestamp: string` сделаны обязательными для гарантии трассировки и дедупликации сообщений.
  - **Файлы:** `packages/dto/src/realtime/websocket-events.dto.ts`

---

### 3. Frontend: Realtime, State & Workspace (`apps/web`)

- [x] **3.1. Тест маппера сообщений: проверка `msg.id` и `envelope.requestId`**
  - **Описание:** В `mapSandboxMessageToEnvelope.test.ts` задаётся `id: "message-123"` в `SandboxRealtimeMessage` и проверяется `expect(envelope.requestId).toBe("message-123")`.
  - **Файлы:** `apps/web/src/features/sandbox/lib/mapSandboxMessageToEnvelope.test.ts`

- [x] **3.2. Разделить проверку собственного участника по транспорту в `useSandboxRealtime`**
  - **Описание:** Для `BroadcastChannel` сравнивается точный идентификатор вкладки/клиента (`clientSessionId`). Канонический `auth.id` используется только для серверных WebSocket-событий, что позволяет локальным вкладкам одного пользователя корректно синхронизироваться.
  - **Файлы:** `apps/web/src/features/sandbox/lib/useSandboxRealtime.ts`

- [x] **3.3. Сверка базовой ревизии перед повторной отправкой `pendingCodeRef`**
  - **Описание:** В `pendingCodeRef` сохраняется базовая ревизия (`baseVersion`). Повторная отправка локального буфера при `room.sync` разрешена исключительно при точном совпадении базовой ревизии с серверной (`baseVersion === serverVersion`, локально-новое состояние). Если серверная версия выше базовой (`serverVersion > baseVersion`, серверно-новое состояние), устаревший буфер сбрасывается во избежание присвоения ему в `codeUpdateWorker` новой глобальной версии и затирания правок другого участника.
  - **Файлы:** `apps/web/src/features/sandbox/lib/useSandboxRealtime.ts`, `apps/web/src/features/sandbox/lib/useSandboxRealtime.test.ts`

- [x] **3.4. Открывать видеопанель только для сигналов звонка (`call-started`, `offer`)**
  - **Описание:** Видеопанель не открывается повторно на `ice-candidate` и `media-state`, а открывается только при `call-started` и `offer`.
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxRoomWorkspace.tsx`, `apps/web/src/features/sandbox/model/SandboxMediaContext.tsx`

- [x] **3.5. Игнорировать устаревший ответ создания сессии в `SandboxRoom` (cleanup-флаг)**
  - **Описание:** Добавлен флаг `cancelled = true` в cleanup-функцию `useEffect`, а ссылки на функции/роутер обернуты в стабильные рефы (`routerRef`, `onSessionReadyRef`), исключая гонки и повторные запросы.
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxRoom.tsx`

- [x] **3.6. Не продолжать работу с неподтверждённым `roomId`**
  - **Описание:** До подтверждения сессии сервером `roomId` не отдается во внешние провайдеры/копирование ссылки, а при ошибке отображается `SandboxRoomError` с кнопкой повтора.
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxRoom.tsx`

- [x] **3.7. Устранить двойной вызов создания сессии в `handleCreateNewSession`**
  - **Описание:** В `handleCreateNewSession` убран предварительный вызов `router.replace` с удалением `room` и `invite`. Изменение URL инициировало повторный запуск эффекта инициализации и параллельный запрос создания второй сессии. Вызывается напрямую `createSession()`, который сам атомарно обновляет параметры URL при успехе.
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxRoom.tsx`, `apps/web/src/features/sandbox/ui/SandboxRoom.test.tsx`

- [x] **3.8. Не пересоздавать интервал таймера при каждом тике в `useSandboxTimer`**
  - **Описание:** Эффект хука `useSandboxTimer` подписан только на `isTimerRunning` (вместо `[isTimerRunning, timerSeconds]`). Исключено накопление задержки ререндеров и отставание таймера, так как метод `tickTimer()` в Zustand уже автоматически останавливает таймер при достижении 0.
  - **Файлы:** `apps/web/src/features/sandbox/model/useSandboxState.ts`, `apps/web/src/features/sandbox/model/useSandboxTimer.test.ts`

---

### 4. Tests & Tasks Models

- [x] **4.1. Использовать `vi.hoisted` для моков в Vitest**
  - **Описание:** Переменные моков, используемые в фабриках `vi.mock`, объявлены через `vi.hoisted`, исключая ошибки TDZ (Temporal Dead Zone).
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxHeader.test.tsx`, `apps/web/src/features/sandbox/ui/SandboxRoom.test.tsx`

- [x] **4.2. Использовать модель связного списка в задаче `reverse-linked-list`**
  - **Описание:** В задаче `reverse-linked-list` определены структуры узлов (`ListNode`) для TypeScript, JavaScript, Python, Go, C++, Java, а тесты проверяют корректное разворачивание узлов списка.
  - **Файлы:** `apps/web/src/features/sandbox/model/tasks.ts`

- [x] **4.3. Проверять видимый результат действий пользователя в тестах UI (Testing Library)**
  - **Описание:** Тесты UI компонентов проверяют наблюдаемый пользователем результат в DOM вместо чтения внутреннего Zustand state (`revealedHints`, `notes`, `isTimerRunning`). Проверяется отображение раскрытых подсказок (`getAllByText(/Открыта ✓/i)`), новое значение textarea (`getByDisplayValue("Updated note")`) и смена кнопки на «Пауза».
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxTaskPanel.test.tsx`, `apps/web/src/features/sandbox/ui/SandboxHeader.test.tsx`

- [x] **4.4. Использовать допустимые значения `BadgeVariant` в `DIFFICULTY_LOCALIZATION`**
  - **Описание:** Тип `BadgeVariant` выводится из `badgeVariants` (`@packages/ui`), в котором определены варианты `statusSuccess`, `statusInfo`, `statusDanger` (вместо `success`, `warning`, `error`). Соответствие сложности задачи приведено к типам дизайн-системы.
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxTaskDescription.tsx`

---

### 5. Безопасность и защита данных (CWE-598 Sensitive Data Exposure)

- [x] **5.1. Устранить передачу `inviteToken` в query string (CWE-598)**
  - **Описание:** `inviteToken` является bearer credential. Передача в query string приводит к утечке через историю браузера, серверные/прокси логи, рефереры и аналитику. Токен исключён из параметров URL создателя сессии, инвайт-ссылка использует URI fragment (`#invite=...`), при входе токен немедленно вычищается из URL через `history.replaceState`, а передача на бэкенд выполняется в теле защищённого `POST /sessions/:id/join`.
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxRoom.tsx`, `apps/web/src/features/sandbox/model/SandboxMediaContext.tsx`, `apps/web/src/features/sandbox/ui/SandboxRoom.test.tsx`, `apps/web/src/shared/lib/url.ts`, `apps/web/src/shared/lib/url.test.ts`, `docs/tasks/sandbox-join-security-and-cleanup.md`

- [x] **5.2. Отзыв и ротация инвайт-токенов (CWE-613 Insufficient Session Expiration)**
  - **Описание:** Детерминированный статический HMAC заменён на 256-битный CSPRNG invite-токен, хранящийся как отдельное значение в ключе `session:${id}:invite` с TTL зеркала. При удалении участника (`removeParticipant`) токен автоматически ротируется и публикуется room-scoped ревокация в realtime (1008), что блокирует повторный вход исключённого пользователя с прежним токеном. Добавлен эндпоинт `POST /sessions/:id/rotate-invite` для владельца сессии.
  - **Файлы:** `apps/api/src/modules/sessions/session-keys.ts`, `apps/api/src/modules/sessions/sessions.service.ts`, `apps/api/src/modules/sessions/sessions.controller.ts`, `packages/dto/src/sessions/join-session.dto.ts`, `packages/dto/src/index.ts`, `apps/api/src/modules/sessions/sessions.service.spec.ts`, `apps/api/src/modules/sessions/sessions.controller.spec.ts`

- [x] **5.3. Устранение TOCTOU-гонки между `joinSession` и `closeSession` (CWE-367)**
  - **Описание:** Устранён интервал между чтением статуса сессии и записью `"true"` + `hset` в Redis. Проверка и обновление переведены на атомарный Lua-скрипт (`ACTIVATE_SESSION_MEMBER_LUA`), выполняющий проверку `current == "closed"` и обновление за одну атомарную операцию в Redis. Добавлен синхронизированный конкурентный тест, гарантирующий невозможность перезаписи `"closed"` на `"true"` при конкурентном закрытии сессии.
  - **Файлы:** `apps/api/src/modules/sessions/sessions.service.ts`, `apps/api/src/redis/redis.service.ts`, `apps/api/src/modules/sessions/sessions.service.spec.ts`


