# Sandbox Feature (Yjs CRDT Architecture)

Модуль интерактивной песочницы для совместного написания и исполнения кода в рамках собеседования.  
Реализует многопользовательскую совместную работу в реальном времени на базе **Yjs CRDT** и **Go Realtime Dumb Relay**.

---

## 1. Архитектура FSD (Feature-Sliced Design)

Модуль расположен в `apps/web/src/features/sandbox` и структурирован по слоям FSD:

```text
apps/web/src/features/sandbox/
├── ui/                     # UI-компоненты песочницы
│   ├── SandboxRoomWorkspace.tsx  # Корневой рабочий контейнер песочницы
│   ├── SandboxHeader.tsx         # Верхняя панель (таймер, статус связи, переключение задач)
│   ├── SandboxControls.tsx       # Панель управления (запуск кода, выбор языка, сброс)
│   ├── OutputPanel.tsx           # Терминал вывода результатов исполнения
│   ├── ExecutionHistory.tsx      # История запусков тестов и решений
│   └── CodeEditorLazy.tsx        # Динамический импорт Monaco Editor
├── model/                  # Состояние, типы и хуки представления
│   ├── types.ts                  # Интерфейсы протокола, состояния комнаты и участников
│   ├── useSandboxCode.ts         # Управление жизненным циклом редактора и шаблонами задач
│   └── ...
└── lib/                    # Сетевая логика, провайдеры и CRDT-биндинги
    ├── RealtimeYjsProvider.ts    # Кастомный Yjs Provider (Ingress ACK, liveQueue, unsentQueue)
    ├── useSandboxRealtime.ts     # Хук интеграции с WebSocket-сервисом (комната, чат, задачи)
    ├── dispatchSandboxMessage.ts # Маршрутизация входящих событий сокета
    └── mapSandboxMessageToEnvelope.ts # Сериализация клиентских сообщений в envelopes
```

---

## 2. Интеграция Yjs CRDT и Monaco Editor

### 2.1. Документ и провайдер
Каждая сессия и задача работают с изолированным документом `Y.Doc`.  
Связующим звеном между WebSocket-транспортом и `Y.Doc` выступает `RealtimeYjsProvider`:
```ts
const yDoc = new Y.Doc();
const yText = yDoc.getText('monaco');
const provider = new RealtimeYjsProvider({
  sessionId,
  taskKey: `${taskId}:${language}`,
  sendEnvelope: (env) => socket.send(JSON.stringify(env)),
  doc: yDoc,
});
```

### 2.2. Биндинг к редактору и локальный UndoManager
Связывание `yText` с инстансом Monaco Editor выполняется через `MonacoBinding`:
```ts
const binding = new MonacoBinding(
  yText,
  editor.getModel()!,
  new Set([editor]),
  provider.awareness
);
```

#### Изоляция истории отмен (Undo / Redo):
Для того чтобы `Ctrl+Z` / `Ctrl+Y` локального пользователя отменяли **только его собственные правки** и не затирали правки удаленного собеседника:
```ts
const undoManager = new Y.UndoManager(yText, {
  trackedOrigins: new Set([binding]),
});
```
Правки удаленных соавторов приходят с origin провайдера (`RealtimeYjsProvider`) и игнорируются локальным менеджером истории.

---

## 3. Multiplayer Awareness (Курсоры и выделение)

Многопользовательское присутствие реализовано через эфемерный протокол `yjs.awareness`:
- Данные положения курсора и селекшена кодируются Yjs Awareness протоколом в компактный бинарный Base64 и рассылаются через `yjs.awareness`.
- `updateYjsAwarenessStyles(userColor, userName)`: динамически генерирует CSS-правила для Monaco Editor, стилизуя курсор и подсветку выделения цветом участника и отображая всплывающий бейдж с именем автора.

---

## 4. Отказоустойчивость и надежность (Resilience)

### 4.1. Ingress ACK и `unsentQueue`
- При любом локальном изменении дельта документа упаковывается в конверт `yjs.update` с уникальным `updateId` и ставится в `unsentQueue`.
- Клиент ожидает серверное подтверждение `yjs.ack` с соответствующим `updateId`. После получения `yjs.ack` дельта удаляется из `unsentQueue`.

### 4.2. Пакетный досыл при Reconnect
- Если сокет разорвался, не подтвержденные дельты остаются в `unsentQueue`.
- При успешном переподключении провайдер выполняет автоматический пакетный досыл всех дельт из `unsentQueue`, гарантируя отсутствие потерь данных, набранных в офлайне.

### 4.3. `liveQueue` и синхронный Drain при `yjs.init` (Subscription-First)
- Для предотвращения гонок между начальной историей и новыми правками используется Subscription-First протокол:
  1. Клиент подключается к комнате и начинает получать live-дельты от других пользователей.
  2. До прихода `yjs.init` все входящие `yjs.update` буферизируются в `liveQueue`.
  3. При получении `yjs.init` серверная история атомарно применяется к документу в единой транзакции `yDoc.transact(...)`.
  4. Сразу же синхронно вычитывается и применяется вся накопленная `liveQueue`.

### 4.4. Error Recovery при `SYNC_FAILED`
- Если бэкенд не может предоставить историю из Redis Stream, он отправляет `room.error` с кодом `SYNC_FAILED`.
- Провайдер переводит состояние в `error`, уведомляет пользователя в UI и инициирует повторное контролируемое переподключение с экспоненциальным backoff.

---

## 5. Изоляция задач и языков по `taskKey`

Стейт кода строго изолирован по составному ключу:
```text
taskKey = "<taskId>:<language>"  // Например: "two-sum:typescript"
```
- Переключение активной задачи или языка (`task.switch`) уничтожает предыдущие инстансы `MonacoBinding` и `RealtimeYjsProvider`, создавая чистое состояние под целевой ключ.
- Это гарантирует невозможность утечки кода или конфликта CRDT-идентификаторов между разными задачами или разными языками решения в рамках одной сессии.

---

## 6. Run Code: Генерация иммутабельного снимка

При нажатии на кнопку **«Запустить код»**:
1. Выполняется атомарное чтение текущего текстового снимка:
   ```ts
   const codeSnapshot = yText.toString();
   ```
2. Снимок фиксируется в запросе к runner-сервису:
   ```ts
   executeCode({
     language,
     code: codeSnapshot,
     stdin,
   });
   ```
3. Правки, вносимые кандидатом или интервьюером во время выполнения кода, никак не влияют на уже запущенный в песочнице билд.
