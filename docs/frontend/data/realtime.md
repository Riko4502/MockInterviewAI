# Справочник типов, контрактов и архитектуры Realtime подсистемы (WebSocket & SSE)

Данный документ содержит исчерпывающее руководство, схемы пакетов, дискриминированные объединения типов (Discriminated Unions), последовательности событий и правила интеграции фронтенд-приложения (`apps/web`) с сервисом `apps/realtime`.

---

## 1. Общая архитектура протоколов

```
                                      +-------------------------------------------------------+
                                      |                Справочник типов Realtime              |
                                      +---------------------------+---------------------------+
                                                                  |
                                   +------------------------------+------------------------------+
                                   |                                                             |
                   (Сессионный уровень: Комната интервью)                       (Глобальный уровень: Весь аккаунт)
                                   v                                                             v
                +------------------------------------+                        +------------------------------------+
                |        WebSocket Protocol          |                        |         SSE Protocol               |
                |       /ws/sessions/:sessionId      |                        |       /sse/notifications           |
                +-----------------+------------------+                        +-----------------+------------------+
                                  |                                                             |
                +-----------------v------------------+                        +-----------------v------------------+
                |  - Конверт: `WebSocketEnvelope<T>` |                        |  - Конверт: `SSEEnvelope<T>`       |
                |  - `room.sync`, `presence.*`       |                        |  - `notification.new`, `badge`     |
                |  - `code.update`, `cursor.move`    |                        |  - `session.invited`               |
                |  - `chat.message`, `media.*`       |                        |  - `code_runner.status`            |
                |  - `ai.request_hint`, `ai.suggest` |                        |  - `ai.report_ready`, `broadcast`  |
                |  - `system.error`, `system.ping`   |                        |  - `account.updated`               |
                +------------------------------------+                        +------------------------------------+
```

### 1.1. Расположение типов в монорепозитории (Import Paths)
* **Канонические DTO и схемы протоколов:** `@packages/dto/realtime` (пакет `packages/dto`).
* **UI-состояния, хуки и селекторы:** `apps/web/src/shared/types/realtime` и `widgets/session-workspace/model/`.

---

## 2. Базовые конверты сообщений и Дискриминированные объединения

### 2.1. Конверт WebSocket пакета

```typescript
export interface BaseWebSocketEnvelope<TType extends string, TPayload> {
  /** Имя события протокола */
  type: TType;
  /** Версия протокола (всегда 1) */
  version: 1;
  /** UUID текущей сессии интервью */
  sessionId: string;
  /** Необязательный UUID запроса для трейсинга и сопоставления ответа */
  requestId?: string;
  /** Время формирования пакета по ISO 8601 */
  timestamp: string;
  /** Типизированная полезная нагрузка */
  payload: TPayload;
}
```

### 2.2. Дискриминированное объединение всех WebSocket событий (AnyWebSocketEnvelope)

Благодаря дискриминированному объединению при проверке `envelope.type` TypeScript **автоматически выводит точный тип `envelope.payload` без ручного приведения типов**:

```typescript
export type AnyWebSocketEnvelope =
  // Сервер ➔ Клиент (Входящие события синхронизации)
  | BaseWebSocketEnvelope<"room.sync", RoomSyncPayload>
  | BaseWebSocketEnvelope<"presence.join", PresenceJoinPayload>
  | BaseWebSocketEnvelope<"presence.leave", PresenceLeavePayload>
  // Двунаправленные события (Клиент ⇄ Сервер)
  | BaseWebSocketEnvelope<"code.update", CodeUpdatePayload>
  | BaseWebSocketEnvelope<"cursor.move", CursorPayload>
  | BaseWebSocketEnvelope<"chat.message", ChatMessagePayload>
  // Медиа-сигналинг LiveKit
  | BaseWebSocketEnvelope<"media.token_request", MediaTokenRequestPayload>
  | BaseWebSocketEnvelope<"media.token_response", MediaTokenResponsePayload>
  | BaseWebSocketEnvelope<"media.state_update", MediaStatePayload>
  | BaseWebSocketEnvelope<"media.speaker", MediaSpeakerPayload>
  | BaseWebSocketEnvelope<"media.recording", MediaRecordingPayload>
  // AI-ассистент
  | BaseWebSocketEnvelope<"ai.request_hint", AIRequestHintPayload>
  | BaseWebSocketEnvelope<"ai.suggestion", AISuggestionPayload>
  // Системные события
  | BaseWebSocketEnvelope<"system.ping", SystemPingPayload>
  | BaseWebSocketEnvelope<"system.ack", SystemAckPayload>
  | BaseWebSocketEnvelope<"system.error", SystemErrorPayload>;
```

### 2.3. Конверт и Дискриминированное объединение SSE событий (AnySSEEnvelope)

```typescript
export interface BaseSSEEnvelope<TType extends string, TPayload> {
  /** Redis Stream ID (например, "1724500000000-0") */
  id: string;
  /** Тип события */
  type: TType;
  /** Время генерации по ISO 8601 */
  timestamp: string;
  /** Данные уведомления */
  payload: TPayload;
}

export type AnySSEEnvelope =
  | BaseSSEEnvelope<"notification.new", NotificationNewPayload>
  | BaseSSEEnvelope<"notification.badge", NotificationBadgePayload>
  | BaseSSEEnvelope<"session.invited", SessionInvitedPayload>
  | BaseSSEEnvelope<"code_runner.status", CodeRunnerStatusPayload>
  | BaseSSEEnvelope<"ai.report_ready", AIReportReadyPayload>
  | BaseSSEEnvelope<"account.updated", AccountUpdatedPayload>
  | BaseSSEEnvelope<"system.broadcast", SystemBroadcastPayload>;
```

---

## 3. Справочник контрактов WebSocket (Интервью-комната)

### 3.1. Синхронизация комнаты и Присутствие (Presence)

```typescript
export type ParticipantRole = "candidate" | "interviewer" | "observer" | "ai";

export interface ParticipantInfo {
  userId: string;
  username: string;
  role: ParticipantRole;
  color?: string; // HEX-цвет курсора/аватара
}

/** Событие "room.sync" (Сервер ➔ Клиент): первый снимок комнаты после входа */
export interface RoomSyncPayload {
  sessionId: string;
  participants: ParticipantInfo[];
  codeState: CodeUpdatePayload | null;
}

/** Событие "presence.join" (Сервер ➔ Клиенты): подключение участника */
export interface PresenceJoinPayload {
  userId: string;
  username: string;
  role: ParticipantRole;
  color?: string;
  userCount: number;
}

/** Событие "presence.leave" (Сервер ➔ Клиенты): отключение участника */
export interface PresenceLeavePayload {
  userId: string;
  username: string;
  role: ParticipantRole;
  userCount: number;
}
```

---

### 3.2. Совместный редактор кода (Code Collaboration)

```typescript
export type SupportedLanguage = "typescript" | "javascript" | "go" | "python" | "cpp" | "java";

/** Событие "code.update" (Клиент ➔ Сервер ➔ Другие участники) */
export interface CodeUpdatePayload {
  /** Относительный путь к файлу (макс. 255 символов) */
  filePath: string;
  /** Язык программирования */
  language: SupportedLanguage | string;
  /** Полное содержимое файла (макс. 500 KB) */
  content: string;
  /** Инкрементный номер ревизии */
  version: number;
}

/** Событие "cursor.move" (Клиент ➔ Сервер ➔ Другие участники) */
export interface CursorPayload {
  userId: string;
  username: string;
  line: number;
  column: number;
  selectionEndLine?: number;
  selectionEndColumn?: number;
}
```

---

### 3.3. Текстовый чат сессии (Session Chat)

```typescript
/** Событие "chat.message" (Клиент ➔ Сервер ➔ Другие участники) */
export interface ChatMessagePayload {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string; // Максимум 4 000 символов
  sentAt: string;
}
```

---

### 3.4. Медиа-сигналинг LiveKit (WebRTC Audio/Video)

```typescript
/** Событие "media.token_request" (Клиент ➔ Сервер): запрос LiveKit JWT */
export interface MediaTokenRequestPayload {
  roomName: string;
}

/** Событие "media.token_response" (Сервер ➔ Клиент) */
export interface MediaTokenResponsePayload {
  token: string;
  serverUrl: string;
}

/** Событие "media.state_update" (Клиент ➔ Сервер ➔ Другие участники) */
export interface MediaStatePayload {
  userId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShare: boolean;
}

/** Событие "media.speaker" (Сервер ➔ Клиенты): активность голоса */
export interface MediaSpeakerPayload {
  userId: string;
  isSpeaking: boolean;
  audioLevel: number; // 0.0 - 1.0
}

/** Событие "media.recording" (Сервер ➔ Клиенты): статус записи */
export interface MediaRecordingPayload {
  isRecording: boolean;
  recordingId?: string;
  startedAt?: string;
}
```

---

### 3.5. Подсказки AI-интервьюера

```typescript
export type AICategory = "hint" | "follow_up_question" | "code_complexity_alert";

/** Событие "ai.request_hint" (Интервьюер ➔ Сервер): запрос генерации подсказки */
export interface AIRequestHintPayload {
  category: AICategory;
  /** Дополнительный контекст или фокус вопроса */
  contextPrompt?: string;
}

/** Событие "ai.suggestion" (Сервер ➔ Собеседующему/Кандидату) */
export interface AISuggestionPayload {
  suggestionId: string;
  targetRole: "interviewer" | "candidate";
  category: AICategory;
  content: string;
  createdAt: string;
}
```

---

### 3.6. Системные события и Диагностика

```typescript
export type SystemErrorCode =
  | "RATE_LIMIT_EXCEEDED"
  | "INVALID_PAYLOAD"
  | "SESSION_MISMATCH"
  | "FORBIDDEN"
  | "ROOM_FULL";

/** Событие "system.error" (Сервер ➔ Клиент) */
export interface SystemErrorPayload {
  code: SystemErrorCode;
  message: string;
  details?: string;
}

/** Событие "system.ping" (Клиент ➔ Сервер): измерение сетевой задержки RTT */
export interface SystemPingPayload {
  clientTime: number; // Unix timestamp в миллисекундах
}

/** Событие "system.ack" (Сервер ➔ Клиент): подтверждение обработки */
export interface SystemAckPayload {
  targetRequestId: string;
  status: "ok" | "processed";
  serverTime?: number;
}
```

---

## 4. Справочник контрактов SSE (Глобальные уведомления)

```typescript
export type NotificationCategory = "info" | "success" | "warning" | "error";

/** Событие "notification.new": тосты и список колокольчика */
export interface NotificationNewPayload {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  actionUrl?: string;
  createdAt: string;
  read: boolean;
}

/** Событие "notification.badge": число непрочитанных */
export interface NotificationBadgePayload {
  unreadCount: number;
}

/** Событие "session.invited": инвайт в комнату */
export interface SessionInvitedPayload {
  sessionId: string;
  sessionTitle: string;
  inviterName: string;
  role: "candidate" | "interviewer";
  joinUrl: string;
  expiresAt: string;
}

/** Событие "code_runner.status": статус прогона тестов */
export type CodeRunnerExecutionStatus = "success" | "failed" | "timeout" | "memory_limit";

export interface CodeRunnerStatusPayload {
  taskId: string;
  sessionId: string;
  status: CodeRunnerExecutionStatus;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number;
}

/** Событие "ai.report_ready": готовность отчета */
export interface AIReportReadyPayload {
  sessionId: string;
  reportId: string;
  score: number; // 0-100
  summary: string;
  reportUrl: string;
}

/** Событие "account.updated": изменение баланса токенов/тарифа */
export interface AccountUpdatedPayload {
  remainingCredits: number;
  plan: "free" | "pro" | "enterprise";
  reason?: string;
}

/** Событие "system.broadcast": системные алерты */
export interface SystemBroadcastPayload {
  severity: "info" | "warning" | "critical";
  message: string;
  maintenanceWindow?: {
    startsAt: string;
    endsAt: string;
  };
}
```

---

## 5. Последовательность событий сессии (Event Flow Diagram)

Типичный жизненный цикл подключения и работы в комнате интервью:

```
[ Frontend (Client) ]                              [ Realtime Server ]                        [ LiveKit SFU ]
          |                                                 |                                        |
          |====== 1. HTTP Upgrade GET /ws/sessions/:id =====>|                                        |
          |<===== 2. 101 Switching Protocols ===============|                                        |
          |                                                 |                                        |
          |<----- 3. event: "room.sync" (участники, код) ---|                                        |
          |       (Монтирование Monaco Editor)              |                                        |
          |                                                 |                                        |
          |------ 4. event: "media.token_request" --------->|                                        |
          |<----- 5. event: "media.token_response" ---------|                                        |
          |====== 6. Подключение WebRTC медиа ======================================================>|
          |                                                 |                                        |
          |------ 7. event: "code.update" (version: 1) ---->|                                        |
          |                                                 |---- 8. Бродкаст "code.update" -------->|
          |------ 9. event: "cursor.move" (line: 12) ------>|                                        |
          |                                                 |---- 10. Бродкаст "cursor.move" ------->|
          |                                                 |                                        |
          |------ 11. event: "ai.request_hint" ------------>|                                        |
          |                                                 |-- (Вызов LLM воркера)                  |
          |<----- 12. event: "ai.suggestion" ---------------|                                        |
```

---

## 6. Стратегия разрешения конфликтов кода (Conflict Resolution)

1. **Модель оптимистичных ревизий (`version`):**
   * Каждый `code.update` содержит монотонно возрастающий номер версии.
   * При локальном наборе клиент инкрементирует `localVersion = localVersion + 1` и отправляет пакет на сервер.
2. **Обработка входящих обновлений от собеседника:**
   * Если `incoming.version > local.version`: локальная модель Monaco Editor обновляется через `executeEdits`, сохраняя текущее положение курсора пользователя без сброса выделения текста.
   * Если `incoming.version <= local.version`: пакет считается устаревшим (out-of-order) и игнорируется.

---

## 7. Мокирование для Storybook, Unit и E2E тестов (Mocking Guide)

Для тестирования интерфейса комнаты в Storybook и Vitest без поднятия живого Go-сервера используется библиотека `mock-socket` или MSW:

### 7.1. Пример мок-сервера для Storybook / Vitest
```typescript
import { Server } from 'mock-socket';

export function setupMockRealtimeServer(wsUrl = 'ws://localhost:8080/ws/sessions/mock-session') {
  const mockServer = new Server(wsUrl);

  mockServer.on('connection', (socket) => {
    // 1. Сразу шлем room.sync
    socket.send(
      JSON.stringify({
        type: 'room.sync',
        version: 1,
        sessionId: 'mock-session',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: 'mock-session',
          participants: [
            { userId: 'u1', username: 'Кандидат', role: 'candidate' },
            { userId: 'u2', username: 'Интервьюер', role: 'interviewer' },
          ],
          codeState: {
            filePath: 'solution.ts',
            language: 'typescript',
            content: 'function twoSum(nums: number[], target: number) {\n  // your code\n}',
            version: 1,
          },
        },
      })
    );

    // 2. Эхо для проверки сообщений чата и кода
    socket.on('message', (data) => {
      const parsed = JSON.parse(data as string);
      if (parsed.type === 'chat.message') {
        socket.send(JSON.stringify(parsed));
      }
    });
  });

  return mockServer;
}
```

---

## 8. Статусы соединений и Коды закрытия

| Код | Название | Причина со стороны сервера | Реакция фронтенда |
| :--- | :--- | :--- | :--- |
| `1000` | `Normal Closure` | Сессия завершена | Плавный выход на экран результатов |
| `1001` | `Going Away` | `displaced by new connection` | Показать предупреждение «Сессия открыта в другой вкладке» |
| `1008` | `Policy Violation`| `user authentication revoked` | Принудительный Logout и редирект на `/login` |
| `1008` | `Policy Violation`| `origin not allowed` | Ошибка CORS конфигурации |
| `1011` | `Internal Error` | Ошибка сервера / потеря Redis | Авто-реконнект с экспоненциальным Backoff |

---

## 9. Ограничения протокола (Validation Constraints)

| Параметр | Лимит | Поведение при превышении |
| :--- | :--- | :--- |
| **Размер кода (`content`)** | `500 KB` | Ошибка `INVALID_PAYLOAD` |
| **Длина чат-сообщения (`text`)** | `4 000 символов` | Обрезка или ошибка `INVALID_PAYLOAD` |
| **Путь к файлу (`filePath`)** | `255 символов` (без `..`) | Отклонение пакета |
| **Частота отправки сообщений** | `60 msg/sec` (всплеск `120`) | Сброс сокета с ошибкой `RATE_LIMIT_EXCEEDED` |
| **Троттлинг курсоров** | `16–30 мс` (~30–60 FPS) | Обязателен на клиенте |
| **Heartbeat SSE** | `15 секунд` | Авто-пинг `: ping\n\n` |
