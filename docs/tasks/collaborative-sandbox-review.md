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

- [x] **3.3. Буферизация изменений во время реконнекта WebSocket**
  - **Описание:** Сохраняются последние неподтверждённые состояния кода и выбранной задачи (`pendingCodeRef`, `pendingTaskRef`) при потере соединения и досылаются после восстановления WebSocket-сессии с защитой от затирания устаревшим `room.sync`.
  - **Файлы:** `apps/web/src/features/sandbox/lib/useSandboxRealtime.ts`

- [x] **3.4. Открывать видеопанель только для сигналов звонка (`call-started`, `offer`)**
  - **Описание:** Видеопанель не открывается повторно на `ice-candidate` и `media-state`, а открывается только при `call-started` и `offer`.
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxRoomWorkspace.tsx`, `apps/web/src/features/sandbox/model/SandboxMediaContext.tsx`

- [x] **3.5. Игнорировать устаревший ответ создания сессии в `SandboxRoom` (cleanup-флаг)**
  - **Описание:** Добавлен флаг `cancelled = true` в cleanup-функцию `useEffect`, а ссылки на функции/роутер обернуты в стабильные рефы (`routerRef`, `onSessionReadyRef`), исключая гонки и повторные запросы.
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxRoom.tsx`

- [x] **3.6. Не продолжать работу с неподтверждённым `roomId`**
  - **Описание:** До подтверждения сессии сервером `roomId` не отдается во внешние провайдеры/копирование ссылки, а при ошибке отображается `SandboxRoomError` с кнопкой повтора.
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxRoom.tsx`

---

### 4. Tests & Tasks Models

- [x] **4.1. Использовать `vi.hoisted` для моков в Vitest**
  - **Описание:** Переменные моков, используемые в фабриках `vi.mock`, объявлены через `vi.hoisted`, исключая ошибки TDZ (Temporal Dead Zone).
  - **Файлы:** `apps/web/src/features/sandbox/ui/SandboxHeader.test.tsx`, `apps/web/src/features/sandbox/ui/SandboxRoom.test.tsx`

- [x] **4.2. Использовать модель связного списка в задаче `reverse-linked-list`**
  - **Описание:** В задаче `reverse-linked-list` определены структуры узлов (`ListNode`) для TypeScript, JavaScript, Python, Go, C++, Java, а тесты проверяют корректное разворачивание узлов списка.
  - **Файлы:** `apps/web/src/features/sandbox/model/tasks.ts`
