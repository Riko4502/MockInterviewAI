# Справочник типов и контрактов Realtime подсистемы (WebSocket & SSE)

Данный документ содержит полную типизацию (TypeScript Contracts), схемы пакетов и форматы событий для взаимодействия фронтенд-приложения (`apps/web`) с бэкендом `apps/realtime`.

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
                |  - `ai.suggestion`, `system.error` |                        |  - `ai.report_ready`, `broadcast`  |
                +------------------------------------+                        +------------------------------------+
```

---

## 2. Базовые конверты сообщений (Envelopes)

### 2.1. Конверт WebSocket пакета

Все сообщения (входящие и исходящие) внутри WebSocket-комнаты упакованы в строго типизированный конверт:

```typescript
export interface WebSocketEnvelope<T = unknown> {
  /** Уникальное имя события протокола (например, "code.update") */
  type: WebSocketEventType;

  /** Версия протокола (на текущий момент всегда 1) */
  version: 1;

  /** Идентификатор текущей сессии интервью (UUID) */
  sessionId: string;

  /** Опциональный ID запроса (UUID) для сопоставления ответа или отслеживания */
  requestId?: string;

  /** Время отправки пакета по UTC в формате ISO 8601 */
  timestamp: string;

  /** Типизированное тело события */
  payload: T;
}
```

### 2.2. Конверт Server-Sent Events (SSE)

Каждое входящее событие в SSE-потоке глобальных уведомлений содержит стандартные метаданные:

```typescript
export interface SSEEnvelope<T = unknown> {
  /** Уникальный ID события из Redis Stream (например, "1724500000000-0") */
  id: string;

  /** Тип события (дублирует поле `event:` из wire-протокола) */
  type: SSEEventType;

  /** Время генерации события в формате ISO 8601 */
  timestamp: string;

  /** Типизированные данные уведомления */
  payload: T;
}
```

---

## 3. Справочник типов событий WebSocket (Интервью-комната)

### 3.1. Перечисление всех типов событий WebSocket

```typescript
export type WebSocketEventType =
  // Синхронизация комнаты и присутствие
  | "room.sync"
  | "presence.join"
  | "presence.leave"
  // Совместная работа с кодом
  | "code.update"
  | "cursor.move"
  // Чат сессии
  | "chat.message"
  // Медиа-сигналинг LiveKit
  | "media.token_request"
  | "media.token_response"
  | "media.state_update"
  | "media.speaker"
  | "media.recording"
  // AI-подсказки и системные сообщения
  | "ai.suggestion"
  | "system.error"
  | "system.ack";
```

---

### 3.2. Синхронизация комнаты и Участники (Presence)

```typescript
/** Роли участников в комнате собеседования */
export type ParticipantRole = "candidate" | "interviewer" | "observer" | "ai";

/** Информация об участнике сессии */
export interface ParticipantInfo {
  /** ID пользователя (из JWT токена) */
  userId: string;
  /** Отображаемое имя */
  username: string;
  /** Роль участника в комнате */
  role: ParticipantRole;
  /** HEX-цвет курсора/аватара (опционально, генерируется сервером) */
  color?: string;
}

/**
 * Событие "room.sync" (Сервер ➔ Клиент)
 * Отправляется клиенту первым сообщением сразу после успешного рукопожатия сокета.
 */
export interface RoomSyncPayload {
  sessionId: string;
  participants: ParticipantInfo[];
  codeState: CodeUpdatePayload | null;
}

/**
 * Событие "presence.join" (Сервер ➔ Клиенты)
 * Уведомление о входе нового участника в комнату.
 */
export interface PresenceJoinPayload {
  userId: string;
  username: string;
  role: ParticipantRole;
  color?: string;
  /** Общее текущее количество участников в комнате */
  userCount: number;
}

/**
 * Событие "presence.leave" (Сервер ➔ Клиенты)
 * Уведомление о выходе участника или закрытии вкладки.
 */
export interface PresenceLeavePayload {
  userId: string;
  username: string;
  role: ParticipantRole;
  userCount: number;
}
```

---

### 3.3. Совместный редактор кода (Code Collaboration)

```typescript
/** Поддерживаемые языки подсветки и выполнения */
export type SupportedLanguage = "typescript" | "javascript" | "go" | "python" | "cpp" | "java";

/**
 * Событие "code.update" (Клиент ➔ Сервер ➔ Другие участники)
 * Полный снимок содержимого редактируемого файла.
 */
export interface CodeUpdatePayload {
  /** Относительный путь к файлу (макс. 255 символов, без '..') */
  filePath: string;
  /** Язык программирования */
  language: SupportedLanguage | string;
  /** Полное содержимое файла (ограничение: макс. 500 KB) */
  content: string;
  /** Инкрементный номер ревизии (версия) */
  version: number;
}

/**
 * Событие "cursor.move" (Клиент ➔ Сервер ➔ Другие участники)
 * Положение курсора и выделенного фрагмента текста.
 */
export interface CursorPayload {
  /** ID пользователя (подставляется сервером из JWT) */
  userId: string;
  /** Имя пользователя (подставляется сервером) */
  username: string;
  /** Номер строки в редакторе (начиная с 1) */
  line: number;
  /** Номер столбца в строке (начиная с 1) */
  column: number;
  /** Конечная строка выделения (если есть выделенный блок) */
  selectionEndLine?: number;
  /** Конечный столбец выделения (если есть выделенный блок) */
  selectionEndColumn?: number;
}
```

---

### 3.4. Текстовый чат сессии (Session Chat)

```typescript
/**
 * Событие "chat.message" (Клиент ➔ Сервер ➔ Другие участники)
 */
export interface ChatMessagePayload {
  /** Уникальный UUID сообщения */
  messageId: string;
  /** ID отправителя (заполняется сервером из JWT) */
  senderId: string;
  /** Имя отправителя (заполняется сервером) */
  senderName: string;
  /** Текст сообщения (максимум 4 000 символов) */
  text: string;
  /** Время отправки по ISO 8601 */
  sentAt: string;
}
```

---

### 3.5. Медиа-сигналинг LiveKit (WebRTC Audio/Video)

```typescript
/**
 * Событие "media.token_request" (Клиент ➔ Сервер)
 * Запрос JWT-токена для подключения к LiveKit комнате.
 */
export interface MediaTokenRequestPayload {
  roomName: string;
}

/**
 * Событие "media.token_response" (Сервер ➔ Клиент)
 */
export interface MediaTokenResponsePayload {
  /** JWT токен доступа к LiveKit Server */
  token: string;
  /** URL LiveKit SFU инстанса */
  serverUrl: string;
}

/**
 * Событие "media.state_update" (Клиент ➔ Сервер ➔ Другие участники)
 * Изменение статуса локальных устройств пользователя.
 */
export interface MediaStatePayload {
  userId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShare: boolean;
}

/**
 * Событие "media.speaker" (Сервер ➔ Клиенты)
 * Индикатор активности голоса (Voice Activity Detection).
 */
export interface MediaSpeakerPayload {
  userId: string;
  isSpeaking: boolean;
  /** Уровень громкости аудиосигнала от 0.0 до 1.0 */
  audioLevel: number;
}

/**
 * Событие "media.recording" (Сервер ➔ Клиенты)
 * Статус облачной записи собеседования (Egress).
 */
export interface MediaRecordingPayload {
  isRecording: boolean;
  recordingId?: string;
  startedAt?: string;
}
```

---

### 3.6. Подсказки AI и Системные события

```typescript
/** Категории AI-подсказок для интервьюера */
export type AICategory = "hint" | "follow_up_question" | "code_complexity_alert";

/**
 * Событие "ai.suggestion" (Сервер ➔ Собеседующему/Кандидату)
 */
export interface AISuggestionPayload {
  suggestionId: string;
  targetRole: "interviewer" | "candidate";
  category: AICategory;
  content: string;
  createdAt: string;
}

/** Коды системных ошибок протокола */
export type SystemErrorCode =
  | "RATE_LIMIT_EXCEEDED" // Превышен лимит отправки (>60 msg/sec)
  | "INVALID_PAYLOAD"     // Ошибка валидации структуры JSON
  | "SESSION_MISMATCH"    // Отправка сообщения в чужую сессию
  | "FORBIDDEN"           // Недостаточно прав для выполнения действия
  | "ROOM_FULL";          // Достигнут лимит участников в комнате

/**
 * Событие "system.error" (Сервер ➔ Клиент)
 */
export interface SystemErrorPayload {
  code: SystemErrorCode;
  message: string;
  details?: string;
}

/**
 * Событие "system.ack" (Сервер ➔ Клиент)
 * Подтверждение успешной обработки запроса с requestId.
 */
export interface SystemAckPayload {
  targetRequestId: string;
  status: "ok" | "processed";
}
```

---

## 4. Справочник типов событий SSE (Глобальные уведомления)

### 4.1. Перечисление всех типов событий SSE

```typescript
export type SSEEventType =
  | "notification.new"     // Новое персональное уведомление
  | "notification.badge"   // Актуализация счетчика непрочитанных
  | "session.invited"      // Инвайт в активную комнату интервью
  | "code_runner.status"   // Статус асинхронного выполнения тестов
  | "ai.report_ready"      // Готовность итогового отчета собеседования
  | "account.updated"      // Изменение баланса токенов/тарифа
  | "system.broadcast";    // Общесистемное оповещение
```

---

### 4.2. Контракты полезной нагрузки SSE-событий

```typescript
/** Категории визуального оформления уведомлений */
export type NotificationCategory = "info" | "success" | "warning" | "error";

/**
 * Событие "notification.new"
 * Основное событие для вывода Toast и сохранения в список колокольчика.
 */
export interface NotificationNewPayload {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  /** Опциональная ссылка для быстрого перехода */
  actionUrl?: string;
  createdAt: string;
  read: boolean;
}

/**
 * Событие "notification.badge"
 * Синхронизация числа непрочитанных сообщений на бейдже колокольчика.
 */
export interface NotificationBadgePayload {
  unreadCount: number;
}

/**
 * Событие "session.invited"
 * Всплывающее приглашение в комнату собеседования.
 */
export interface SessionInvitedPayload {
  sessionId: string;
  sessionTitle: string;
  inviterName: string;
  role: "candidate" | "interviewer";
  joinUrl: string;
  /** ISO 8601 время истечения срока действия инвайта */
  expiresAt: string;
}

/** Статусы выполнения автотестов в code-runner */
export type CodeRunnerExecutionStatus = "success" | "failed" | "timeout" | "memory_limit";

/**
 * Событие "code_runner.status"
 */
export interface CodeRunnerStatusPayload {
  taskId: string;
  sessionId: string;
  status: CodeRunnerExecutionStatus;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number;
}

/**
 * Событие "ai.report_ready"
 */
export interface AIReportReadyPayload {
  sessionId: string;
  reportId: string;
  score: number; // Общий балл от 0 до 100
  summary: string;
  reportUrl: string;
}

/**
 * Событие "account.updated"
 */
export interface AccountUpdatedPayload {
  remainingCredits: number;
  plan: "free" | "pro" | "enterprise";
  reason?: string;
}

/**
 * Событие "system.broadcast"
 */
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

## 5. Статусы соединений и Коды закрытия сокетов

### 5.1. Статусы подключения на клиенте

```typescript
export type RealtimeConnectionStatus =
  | "idle"          // Соединение еще не инициализировано
  | "connecting"    // Идет процесс установления соединения
  | "connected"     // Соединение активно и готово к обмену
  | "reconnecting"  // Потеря связи, попытка авто-восстановления
  | "disconnected"; // Соединение закрыто
```

### 5.2. Коды закрытия WebSocket (WebSocket Close Codes)

| Код (Code) | Название | Причина со стороны сервера | Реакция фронтенда |
| :--- | :--- | :--- | :--- |
| `1000` | `Normal Closure` | Сессия завершена или комната закрыта | Плавный сброс состояния, выход на дашборд |
| `1001` | `Going Away` | `displaced by new connection` (открыта новая вкладка) | Показать предупреждающий баннер о вытеснении |
| `1008` | `Policy Violation`| `user authentication revoked` (отзыв JWT токена) | Принудительный Logout и редирект на `/login` |
| `1008` | `Policy Violation`| `origin not allowed` (нарушение CORS) | Ошибка конфигурации среды |
| `1011` | `Internal Error` | `server error or redis failure` | Автоматический реконнект с задержкой (Backoff) |

---

## 6. Ограничения протоколов и валидация (Validation Constraints)

| Параметр | Лимит | Поведение при нарушении |
| :--- | :--- | :--- |
| **Размер кода (`content`)** | `500 KB` | Отклонение пакета с `INVALID_PAYLOAD` |
| **Длина сообщения чата (`text`)** | `4 000 символов` | Обрезка текста или ошибка `INVALID_PAYLOAD` |
| **Путь к файлу (`filePath`)** | `255 символов` (без `..`) | Отклонение пакета |
| **Частота отправки сообщений** | `60 msg/sec` (всплеск до `120`) | Сброс сокета с ошибкой `RATE_LIMIT_EXCEEDED` |
| **Рекомендуемый троттлинг курсоров** | `16–30 мс` (~30–60 FPS) | Обязательно троттлить на фронтенде |
| **Heartbeat SSE (Keep-Alive)** | `15 секунд` | Автоматический комментарий `: ping\n\n` |
