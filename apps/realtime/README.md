# Realtime Service (Go WebSocket Backend)

Высокопроизводительный сервис реального времени для платформы **MockInterviewAI**, обеспечивающий совместное редактирование кода, трекинг курсоров участников, чат сессии, сигналинг LiveKit (видео/аудио трансляции) и подсказки AI в реальном времени.

---

## 📌 1. Подключение с frontend (Connection Guide)

### URL подключения
* **WebSocket (Двунаправленный сессионный канал):**
  * `ws://localhost:8080/ws/sessions/:sessionId` (Локальная разработка)
  * `wss://realtime.yourdomain.com/ws/sessions/:sessionId` (Prod)
* **Server-Sent Events (Глобальный поток уведомлений пользователя):**
  * `http://localhost:8080/sse/notifications` (Персональные инвайты, результаты тестов, AI-отчеты)
  * Подробная спецификация: [SSE_SPEC.md](./SSE_SPEC.md)



### Аутентификация
* Сервер считывает токен **исключительно из HTTP Cookie `access_token`**.
* В браузере вызов `new WebSocket("ws://localhost:8080/ws/sessions/" + sessionId)` **автоматически отправляет cookies** на сервер.
* **Важно**: Никакие токены в GET query-параметрах (`?token=...`) передавать не нужно (в целях безопасности это заблокировано).
* Роль пользователя (`candidate`, `interviewer`, `observer`) определяется сервером автоматически на основе сессионного контекста в **Redis**.

---

## 2. Базовая структура пакета (Protocol Envelope)

Все сообщения между клиентом и сервером упакованы в единый строго типизированный конверт:

```typescript
export interface WebSocketEnvelope<T> {
  type: EventType;        // Имя события (например, "code.update")
  version: number;        // Версия протокола (всегда 1)
  sessionId: string;      // ID текущей сессии интервью
  requestId?: string;     // Необязательный ID запроса (UUID) для сопоставления ответа
  timestamp: string;      // ISO 8601 строка (генерируется сервером)
  payload: T;             // Типизированное тело события
}
```

---

## 📋 3. Справочник событий (TypeScript Protocol Specification)

### 3.1. Синхронизация комнаты и Присутствие (Presence)

#### `room.sync` (Сервер ➔ Клиент, сразу при входе)
Отправляется новому участнику первым сообщением после успешного рукопожатия сокета. Содержит полный снимок комнаты (всех участников и последний сохраненный код в редакторе).

```typescript
export interface ParticipantInfo {
  userId: string;
  username: string;
  role: "candidate" | "interviewer" | "observer" | "ai";
}

export interface RoomSyncPayload {
  sessionId: string;
  participants: ParticipantInfo[];
  codeState: CodeUpdatePayload | null;
}
```

#### `presence.join` (Сервер ➔ Клиент)
Рассылается участникам, когда в комнату подключается новый пользователь.

```typescript
export interface PresenceJoinPayload {
  userId: string;
  username: string;
  role: string;
  color?: string;       // HEX цвет курсора/аватара
  userCount: number;    // Общее количество участников в комнате
}
```

#### `presence.leave` (Сервер ➔ Клиент)
Рассылается участникам, когда пользователь отключился или закрыл вкладку.

```typescript
export interface PresenceLeavePayload {
  userId: string;
  username: string;
  role: string;
  userCount: number;
}
```

---

### 3.2. Совместный редактор кода (Code Collaboration)

#### `code.update` (Клиент ➔ Сервер ➔ Другие участники)
Отправляется при изменении кода в Monaco Editor.

```typescript
export interface CodeUpdatePayload {
  filePath: string;      // Относительный путь (макс. 255 симв., без '..')
  language: string;      // Язык подсветки ("typescript", "go", "python")
  content: string;       // Полное содержимое файла (макс. 500 KB)
  version: number;       // Инкрементный номер ревизии
}
```

#### `cursor.move` (Клиент ➔ Сервер ➔ Другие участники)
Передает координаты курсора и выделения текста пользователя.

```typescript
export interface CursorPayload {
  userId: string;        // Подставляется сервером из JWT (спуфинг невозможен)
  username: string;
  line: number;          // Номер строки (от 1)
  column: number;        // Номер столбца (от 1)
  selectionEndLine?: number;
  selectionEndColumn?: number;
}
```

---

### 3.3. Текстовый чат сессии (Session Chat)

#### `chat.message` (Клиент ➔ Сервер ➔ Другие участники)

```typescript
export interface ChatMessagePayload {
  messageId: string;     // UUID сообщения
  senderId: string;      // Заполняется сервером из JWT
  senderName: string;    // Заполняется сервером из JWT
  text: string;          // Текст сообщения (макс. 4 000 символов)
  sentAt: string;        // ISO 8601 время отправки
}
```

---

### 3.4. Видео/Аудио трансляция LiveKit (WebRTC Media Signaling)

WebRTC медиа-потоки идут напрямую через LiveKit Server. Сервис `apps/realtime` координирует статусы устройств и токены подключения.

#### `media.token_request` (Клиент ➔ Сервер)
Запрос токена подключения к LiveKit комнате.
```typescript
export interface MediaTokenRequestPayload {
  roomName: string;
}
```

#### `media.token_response` (Сервер ➔ Клиент)
Ответ с JWT токеном для LiveKit SDK (`livekit-client`).
```typescript
export interface MediaTokenResponsePayload {
  token: string;
  serverUrl: string;
}
```

#### `media.state_update` (Клиент ➔ Сервер ➔ Другие участники)
Уведомление о включении/выключении микрофона, камеры или демонстрации экрана.
```typescript
export interface MediaStatePayload {
  userId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShare: boolean;
}
```

#### `media.speaker` (Сервер ➔ Клиенты)
Индикатор активности голоса (кто сейчас говорит).
```typescript
export interface MediaSpeakerPayload {
  userId: string;
  isSpeaking: boolean;
  audioLevel: number;    // От 0.0 до 1.0
}
```

#### `media.recording` (Сервер ➔ Клиенты)
Статус записи интервью (для последующего AI-анализа).
```typescript
export interface MediaRecordingPayload {
  isRecording: boolean;
  recordingId?: string;
  startedAt?: string;
}
```

---

### 3.5. Подсказки AI-интервьюера (AI Suggestions)

#### `ai.suggestion` (Сервер ➔ Собеседующему)
Подсказки кандидату или интервьюеру от AI-ассистента.
```typescript
export interface AISuggestionPayload {
  suggestionId: string;
  targetRole: "interviewer" | "candidate";
  category: "hint" | "follow_up_question" | "code_complexity_alert";
  content: string;
  createdAt: string;
}
```

---

### 3.6. Системные ошибки (System Errors)

#### `system.error` (Сервер ➔ Клиент)
```typescript
export interface SystemErrorPayload {
  code: 
    | "RATE_LIMIT_EXCEEDED"     // Превышен лимит сообщений (макс 60 msg/sec)
    | "INVALID_PAYLOAD"         // Ошибка валидации структуры JSON
    | "SESSION_MISMATCH"        // Попытка отправить сообщение в чужую сессию
    | "FORBIDDEN"               // Доступ запрещен
    | "ROOM_FULL";              // В комнате достигнут лимит участников
  message: string;
  details?: string;
}
```

---

## 4. Ключевые правила безопасности для frontend

1. **Единое соединение на вкладку**: Сервер вытесняет старое соединение, если пользователь открывает сессию в новой вкладке.
2. **Лимит частоты (Rate Limiter)**: Сервер допускает до **60 событий/сек** (со всплеском до 120). При отправке движений курсора рекомендуется делать `throttle` на клиенте (например, раз в 16-30 мс / ~30-60 FPS).
3. **Лимит размера текста**: Сообщения чата обрезаются до 4 000 символов, файлы кода ограничены 500 KB.
