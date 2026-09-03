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
* **Тикет в subprotocol:** перед каждым WS-подключением клиент вызывает `POST /realtime/ticket` (Bearer access) и передает одноразовый тикет в `Sec-WebSocket-Protocol: ["realtime", <ticket>]`; сервер согласует subprotocol `realtime`.
* Приоритет извлечения кредов на handshake: **subprotocol-тикет → `Authorization: Bearer` → HttpOnly Cookie** (`access_token`).
* Тикет привязан к комнате (`sessionId` mismatch → `403`) и одноразовый (`ConsumeTicket` по `jti`; повторное использование → `401`).
* **Важно**: Никакие токены в GET query-параметрах (`?token=...`) передавать не нужно (в целях безопасности это заблокировано).
* Роль пользователя (`candidate`, `interviewer`, `observer`) определяется сервером строго по членству в сессии в **Redis** (`session:{id}:members`, `GetSessionUserRole`, fail-closed).

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

---

## 5. Глобальный поток уведомлений (Server-Sent Events)

Эндпоинт `GET /sse/notifications` — однонаправленный поток персональных и общесистемных уведомлений, живущий столько же, сколько сессия логина пользователя. Полная архитектура: [SSE_SPEC.md](./SSE_SPEC.md).

### 5.1. Подключение с фронтенда

```typescript
import { fetchEventSource } from "@microsoft/fetch-event-source";

await fetchEventSource("http://localhost:8080/sse/notifications", {
  credentials: "include", // cookie access_token уходит автоматически
  onmessage(event) {
    // event.id — Redis Stream ID, он же Last-Event-ID при переподключении
    const envelope = JSON.parse(event.data); // BaseSSEEnvelope<TPayload>
    handle(envelope.type, envelope.payload);
  },
});
```

* Токен читается только из `HttpOnly` cookie `access_token` или заголовка `Authorization: Bearer <JWT>`.
* Передача токена в query string (`?token=...`) отклоняется с кодом **400**: это защита от утечки JWT в access-логи прокси, историю браузера и `Referer`.
* Браузер сам переподключается и присылает `Last-Event-ID`; сервер отдает пропущенные события из Redis Stream (фаза Replay), после чего переходит в живой режим.
* Каждое событие содержит детерминированный `id`, поэтому клиентскому стейт-менеджеру достаточно дедуплицировать по нему.

### 5.2. Конверт события

```typescript
export interface BaseSSEEnvelope<TPayload> {
  id: string;        // Redis Stream ID ("1724500000000-0"); отсутствует у бродкастов
  type: string;      // "notification.new", "ai.report_ready", ...
  timestamp: string; // ISO 8601
  payload: TPayload;
}
```

Типы событий и их payload описаны в [SSE_SPEC.md](./SSE_SPEC.md) (раздел 4.2) и в справочнике фронтенда `docs/frontend/data/realtime.md` (раздел 4). Дополнительно сервер отправляет служебное событие `auth.revoked` — последний кадр перед принудительным разрывом потока при смене пароля или выходе со всех устройств.

Каждые 15 секунд в поток пишется heartbeat-комментарий `: ping <unix_ms>`, который игнорируется парсером `EventSource` и удерживает соединение через прокси.

### 5.3. Контракт продюсеров (apps/api, apps/code-runner, AI worker)

Персональное уведомление публикуется в стрим пользователя, общесистемное — в Pub/Sub канал:

```bash
# Персональное событие (доставляется всем вкладкам пользователя, попадает в Replay)
XADD user:{userId}:notifications MAXLEN '~' 100 '*' \
  type notification.new \
  payload '{"id":"ntf_1","category":"info","title":"...","message":"...","createdAt":"...","read":false}' \
  timestamp 2026-08-30T10:00:00Z

# Общесистемный алерт (доставляется всем подключенным клиентам кластера, без Replay)
PUBLISH notifications:broadcast '{"type":"system.broadcast","payload":{"severity":"warning","message":"..."}}'

# Мгновенный отзыв авторизации: все SSE-потоки пользователя разрываются на всех нодах
PUBLISH auth:revocations '{"instanceId":"api","data":"<userId base64>"}'
```

Сервису достаточно полей `type` и `payload`; `timestamp` необязателен — при его отсутствии время восстанавливается из Redis Stream ID. Ключ стрима автоматически ограничивается сотней последних событий и получает `EXPIRE` на 7 суток при каждой публикации.

### 5.4. Лимиты и защита ресурсов

| Ограничение | Значение по умолчанию | Переменная окружения |
| :--- | :--- | :--- |
| Соединений на пользователя | 5 (по всему кластеру) | `SSE_MAX_CONNECTIONS_PER_USER` |
| Соединений с одного IP | 20 (на ноду) | `SSE_MAX_CONNECTIONS_PER_IP` |
| Буфер одного соединения | 128 событий | `SSE_CLIENT_BUFFER_SIZE` |
| Heartbeat | 15 сек | `SSE_HEARTBEAT_SECONDS` |
| Retry клиента | 3000 мс | `SSE_RETRY_MS` |
| Размер страницы Replay | 20 событий | `SSE_REPLAY_COUNT` |

При превышении лимитов возвращается **429 Too Many Requests** с заголовком `Retry-After`. Медленный клиент, чей буфер остается переполненным дольше `SSE_SLOW_CONSUMER_GRACE_SECONDS`, отключается — он переподключится сам и доберет пропущенное через `Last-Event-ID`.

`SSE_REPLAY_COUNT` задает размер одной страницы `XRANGE`, а не общую глубину восстановления: фаза Replay листает историю до полного исчерпания стрима, поэтому клиент получает все пропущенное (стрим ограничен сотней последних событий) за одно переподключение. Предохранитель на 1000 событий за фазу защищает от аномального продюсера, и его срабатывание пишется в лог предупреждением — обрыв истории не остается незамеченным.

### 5.5. Наблюдаемость

Метрики SSE-подсистемы (`realtime_sse_connected_clients`, `realtime_sse_messages_dispatched_total`, `realtime_sse_dropped_messages_total`, `realtime_sse_redis_stream_lag_seconds` и др.) отдаются эндпоинтом `GET /metrics` в текстовом формате Prometheus.

Эндпоинт предназначен для внутреннего скрейпинга: запросы принимаются только с петлевых и частных адресов (localhost, сеть Docker, подсеть Kubernetes), остальным отдается **404**. Адрес берется из реального TCP-пира, заголовки прокси не учитываются. Снять ограничение можно переменной `METRICS_ALLOW_PUBLIC=true` — только если эндпоинт закрыт аутентификацией на уровне обратного прокси.

Сводка по SSE также попадает в `GET /readyz` (`sseClients`, `sseUsers`). При недоступном Redis `/readyz` отвечает **503** со `"status":"degraded"`, чтобы readiness-проба вывела инстанс из ротации; осознанно выключенный Redis (`REDIS_ENABLED=false`) готовность не отменяет.

### 5.6. Настройка Nginx

Долгоживущий поток требует отключения буферизации и сжатия на уровне обратного прокси:

```nginx
location /sse/ {
    proxy_pass http://realtime;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    gzip off;
    proxy_read_timeout 3600s;
}
```

Сервис дополнительно выставляет заголовок `X-Accel-Buffering: no` на каждый SSE-ответ.
