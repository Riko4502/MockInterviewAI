# Архитектура видеовстреч (`apps/api` & LiveKit)

Сервис универсальных видеокомнат (Instant Meeting Rooms) обеспечивает организацию прямых видеозвонков 1-на-1 и групповых созвонов (HR-скрининги, System Design секции, behavioral-интервью, P2P-нетворкинг) без привязки к Monaco-редактору кода.

---

## 1. Назначение и ключевые принципы

* **Мгновенный старт**: генерация встречи в один клик без предварительного планирования слотов.
* **Равноправие медиапотоков (Peers)**: все участники встречи обладают правами на вебкамеру, микрофон, демонстрацию экрана с системным звуком (`screen_share_audio`) и DataChannel-чат.
* **Смешанный доступ (Hybrid Auth)**:
  * Авторизованные пользователи регистрируются с привязкой `userId` и профиля.
  * Гости (`guest_${uuid}`) подключаются без регистрации по capability URL или с вводом пароля, не захламляя таблицу пользователей в PostgreSQL.
* **Fail-Closed & Rate-Limiting**: защита закрытых комнат паролем (хеширование Argon2id) с защитой от brute-force перебора в Redis (5 попыток на IP за 15 минут).

---

## 2. Модель данных и схема сессий

```text
Prisma: InterviewSession
┌────────────────────────────────────────────────────────────┐
│ id:           UUID (Primary Key)                           │
│ userId:       UUID (Владелец / Организатор)                │
│ type:         InterviewSessionType (DEFAULT | MEETING)     │
│ title:        String? ("Архитектурный синк", "HR скрининг")│
│ isPrivate:    Boolean (true если защищен паролем)          │
│ passwordHash: String? (Argon2id хеш пароля)                │
│ inviteToken:  String (64-символьный capability hex-токен)  │
│ status:       SessionStatus (ACTIVE | CLOSED)              │
│ createdAt:    DateTime                                     │
│ updatedAt:    DateTime                                     │
└────────────────────────────────────────────────────────────┘
```

Роли участников (`InterviewParticipantRole`):
* `HOST`: создатель комнаты. Обладает правами на публикацию всех медиа и завершение встречи для всех (`POST /sessions/:id/end`).
* `PARTICIPANT`: равноправный участник созвона. Имеет полный доступ к видео, аудио, показу экрана и чату.

---

## 3. Модель LiveKit Grants

Сервис [`LivekitService`](file:///c:/work/MyProjects/MockInterviewAI/apps/api/src/modules/realtime/livekit.service.ts) выпускает JWT-токены подключения к комнате LiveKit (`RoomName = sessionId`).

### Матрица прав:

| Роль | `canPublish` | `canPublishSources` | `canSubscribe` | `canPublishData` |
|---|---|---|---|---|
| `HOST` | `true` | `camera`, `microphone`, `screen_share`, `screen_share_audio` | `true` | `true` |
| `PARTICIPANT` | `true` | `camera`, `microphone`, `screen_share`, `screen_share_audio` | `true` | `true` |
| `INTERVIEWER` (sandbox) | `true` | `camera`, `microphone`, `screen_share` | `true` | `false` |
| `CANDIDATE` (sandbox) | `true` | `camera`, `microphone` | `true` | `false` |
| `OBSERVER` | `false` | `-` | `true` | `false` |

Для встреч типа `MEETING` флаг `canPublishData: true` обязателен — через него функционирует обмен сообщениями текстового чата, статусы поднятия руки и эмодзи-реакции.

---

## 4. Протокол сообщений LiveKit DataChannel

Обмен событиями в реальном времени внутри комнаты происходит через LiveKit DataChannel (топик по умолчанию, надежная доставка `reliable: true` для чата и `lossy: false` для реакций):

```typescript
type MeetingDataPacket =
  | {
      type: "chat_message";
      payload: {
        id: string;
        senderId: string;
        senderName: string;
        text: string;
        timestamp: number;
      };
    }
  | {
      type: "hand_raise";
      payload: {
        participantId: string;
        raised: boolean;
      };
    }
  | {
      type: "reaction";
      payload: {
        id: string;
        participantId: string;
        emoji: "👍" | "❤️" | "👏" | "🔥" | "🎉";
      };
    };
```

Клиентский парсер валидирует входящие байты через `TextDecoder("utf-8")` и безопасный `JSON.parse` с игнорированием невалидных или неизвестных типов пакетов.

---

## 5. Redis State и зеркалирование сессий

Для исключения частых обращений в PostgreSQL при пиковых нагрузках активные сессии кэшируются в Redis:

1. **Флаг активности**:
   - Ключ: `session:${sessionId}:active`
   - Значения: `"true"` (сессия активна) или `"closed"` (сессия завершена).
   - TTL: 7200 сек (2 часа).
2. **Участники звонка**:
   - Хеш: `session:${sessionId}:members`
   - Поля: `${participantId}` -> `${role}` (`HOST` или `PARTICIPANT`).
   - Для гостей используется ID вида `guest_${randomUUID()}`. Гости **не записываются** в БД, что гарантирует чистоту реляционной базы.
3. **Защита от перебора паролей (Brute-force protection)**:
   - Ключ: `ratelimit:meeting:password:${sessionId}:${clientIp}`
   - TTL: 900 сек (15 минут).
   - Лимит: максимум 5 неверных попыток, после чего возвращается HTTP 429 Too Many Requests.
   - Передача валидного `inviteToken` (Capability URL) автоматически пропускает проверку пароля.

---

## 6. HTTP API Эндпоинты

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| `POST` | `/sessions/meeting` | Bearer Auth | Создание встречи (`title`, `isPrivate`, `password`). Возвращает `sessionId`, `inviteToken`, `role: HOST`. |
| `GET` | `/sessions/:id/lobby` | Public (`@Public()`) | Получение публичных метаданных лобби (название, хост, статус, требование пароля). |
| `POST` | `/sessions/:id/join-meeting` | Public (`@Public()`) + Optional Auth | Вход во встречу. Принимает `guestName`, `password`, `inviteToken`. Возвращает LiveKit `mediaToken` и роль. |
| `POST` | `/sessions/:id/end` | Bearer Auth (`HOST` only) | Принудительное завершение встречи для всех участников. Переводит сессию в статус `CLOSED` и ревоцирует доступ. |
