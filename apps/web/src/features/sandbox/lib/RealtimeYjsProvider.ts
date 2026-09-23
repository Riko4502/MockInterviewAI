import type {
  AnyWebSocketEnvelope,
  BaseWebSocketEnvelope,
  RoomErrorPayload,
  YjsAckPayload,
  YjsAwarenessPayload,
  YjsInitPayload,
  YjsUpdatePayload,
} from "@packages/dto";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";

/**
 * Преобразует Uint8Array в строку Base64.
 * Работает как в Node.js/Vitest, так и в браузере.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Преобразует строку Base64 в Uint8Array.
 * Работает как в Node.js/Vitest, так и в браузере.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export type ProviderStatus =
  | "INITIALIZING"
  | "SYNCED"
  | "DISCONNECTED"
  | "ERROR";

export const MAX_LIVE_QUEUE_SIZE = 1000;
export const MAX_UNSENT_QUEUE_SIZE = 1000;

export interface QueuedUpdate {
  updateId: string;
  data: Uint8Array;
}

export interface RealtimeYjsProviderOptions {
  doc: Y.Doc;
  taskKey: string;
  sessionId: string;
  /** Опциональный инстанс Awareness (если не передан, создается new Awareness(doc)) */
  awareness?: Awareness;
  /** Пользовательские данные для awareness (userId, name, color) */
  user?: {
    userId?: string;
    id?: string;
    name?: string;
    color?: string;
    [key: string]: unknown;
  };
  /** Опциональный прямой WebSocket или кастомный transport sender */
  socket?: WebSocket | null;
  /** Опциональная функция отправки конверта через существующий сессионный сокет */
  sendEnvelope?: (envelope: AnyWebSocketEnvelope) => void;
  /** Начальный статус провайдера (по умолчанию: INITIALIZING при подключении или DISCONNECTED) */
  initialStatus?: ProviderStatus;
  /** Колбэк при возникновении критических ошибок синхронизации */
  onError?: (error: Error) => void;
  /** Колбэк при смене статуса провайдера */
  onStatusChange?: (status: ProviderStatus) => void;
  /** Колбэк при успешном переходе в статус SYNCED */
  onSynced?: () => void;
}

/**
 * RealtimeYjsProvider (Phase 1–5: T017, T019, T022, T024–T028)
 *
 * Отвечает за:
 * 1. Подписку на локальные doc.on('update') и буферизацию в unsentQueue (T024).
 * 2. Удержание дельт в unsentQueue до получения Ingress ACK (yjs.ack) (T024).
 * 3. Контракт повторной отправки очереди unsentQueue при реконнекте (Unsent Queue Drain Contract)
 *    с батчингом через Y.mergeUpdates и сохранением соответствия batchUpdateId (T025).
 * 4. Буферизацию входящих дельт в liveQueue при статусе INITIALIZING и строго синхронный
 *    цикл накатки истории и опустошения liveQueue при получении yjs.init (T026).
 * 5. Контроль переполнения очередей (MAX_LIVE_QUEUE_SIZE, MAX_UNSENT_QUEUE_SIZE) с переходом в ERROR (T026).
 * 6. Фильтрацию собственных обновлений (origin === this) для полного исключения сетевых петель (echo-loop).
 * 7. Протокол Awareness (T019): трансляция кареток и выделений, упаковка в yjs.awareness.
 * 8. Очистка присутствия (T022): обработка presence.leave, вызов removeAwarenessStates, локальный destroy.
 */
export class RealtimeYjsProvider {
  public readonly doc: Y.Doc;
  public readonly taskKey: string;
  public readonly sessionId: string;
  public readonly awareness: Awareness;

  private readonly socket: WebSocket | null;
  private readonly sendEnvelopeFn?: (envelope: AnyWebSocketEnvelope) => void;
  private readonly onError?: (error: Error) => void;
  private readonly onStatusChange?: (status: ProviderStatus) => void;
  private readonly onSynced?: () => void;

  private seq = 0;
  private readonly providerId: string;
  private isDestroyed = false;
  private readonly ownsAwareness: boolean;

  private _status: ProviderStatus;
  private unsentQueue: QueuedUpdate[] = [];
  private liveQueue: Uint8Array[] = [];
  private batchMap = new Map<string, Set<string>>(); // batchUpdateId -> Set<originalUpdateId>

  private readonly updateListener: (
    update: Uint8Array,
    origin: unknown,
  ) => void;
  private readonly awarenessUpdateListener: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => void;
  private readonly socketOpenListener?: () => void;
  private readonly socketCloseListener?: () => void;
  private readonly socketErrorListener?: () => void;
  private readonly socketMessageListener?: (event: MessageEvent) => void;

  constructor(options: RealtimeYjsProviderOptions) {
    this.doc = options.doc;
    this.taskKey = options.taskKey;
    this.sessionId = options.sessionId;
    this.socket = options.socket ?? null;
    this.sendEnvelopeFn = options.sendEnvelope;
    this.onError = options.onError;
    this.onStatusChange = options.onStatusChange;
    this.onSynced = options.onSynced;
    this.providerId = `client_${Math.random().toString(36).substring(2, 9)}`;

    this.ownsAwareness = !options.awareness;
    this.awareness = options.awareness ?? new Awareness(this.doc);

    // Определяем начальный статус
    if (options.initialStatus) {
      this._status = options.initialStatus;
    } else if (this.socket) {
      this._status =
        this.socket.readyState === WebSocket.OPEN
          ? "INITIALIZING"
          : "DISCONNECTED";
    } else {
      this._status = "SYNCED";
    }

    // 1. Слушатель локальных изменений Y.Doc (T017, T024)
    this.updateListener = (update: Uint8Array, origin: unknown) => {
      // Игнорируем обновления, примененные провайдером из сети (исключаем echo loop)
      if (origin === this || this.isDestroyed) {
        return;
      }

      if (this.unsentQueue.length >= MAX_UNSENT_QUEUE_SIZE) {
        const err = new Error(
          `SyncError: unsent queue limit exceeded (${MAX_UNSENT_QUEUE_SIZE})`,
        );
        this.transitionTo("ERROR");
        this.onError?.(err);
        return;
      }

      const updateId = `${this.providerId}:${++this.seq}`;
      const queuedItem: QueuedUpdate = { updateId, data: update };
      this.unsentQueue.push(queuedItem);

      // При нормальном активном подключении (SYNCED) отправляем сразу в сокет (T024)
      if (this._status === "SYNCED") {
        this.sendUpdate(updateId, update);
      }
    };
    this.doc.on("update", this.updateListener);

    // 2. Слушатель изменений Awareness (T019)
    this.awarenessUpdateListener = ({ added, updated, removed }, origin) => {
      if (origin === this || this.isDestroyed) {
        return;
      }
      const changedClients = added.concat(updated, removed);
      if (changedClients.length === 0) {
        return;
      }
      const update = encodeAwarenessUpdate(this.awareness, changedClients);
      this.sendAwareness(update);
    };
    this.awareness.on("update", this.awarenessUpdateListener);

    if (options.user) {
      this.awareness.setLocalStateField("user", options.user);
    }

    // 3. Слушатели событий WebSocket (если передан сырой WebSocket)
    if (this.socket) {
      this.socketOpenListener = () => {
        if (!this.isDestroyed) {
          this.connect();
        }
      };
      this.socketCloseListener = () => {
        if (!this.isDestroyed) {
          this.disconnect();
        }
      };
      this.socketErrorListener = () => {
        if (!this.isDestroyed) {
          this.disconnect();
        }
      };
      this.socketMessageListener = (event: MessageEvent) => {
        if (this.isDestroyed) return;
        try {
          const rawData =
            typeof event.data === "string"
              ? event.data
              : event.data?.toString();
          if (!rawData) return;
          const envelope = JSON.parse(rawData) as AnyWebSocketEnvelope;
          this.handleMessage(envelope);
        } catch {
          // Игнорируем не-JSON сообщения
        }
      };

      this.socket.addEventListener("open", this.socketOpenListener);
      this.socket.addEventListener("close", this.socketCloseListener);
      this.socket.addEventListener("error", this.socketErrorListener);
      this.socket.addEventListener("message", this.socketMessageListener);
    }
  }

  /**
   * Текущий статус синхронизации провайдера.
   */
  public get status(): ProviderStatus {
    return this._status;
  }

  /**
   * Возвращает true, если провайдер полностью синхронизирован с сервером.
   */
  public get isSynced(): boolean {
    return this._status === "SYNCED";
  }

  /**
   * Число неотправленных/неподтвержденных локальных дельт в очереди.
   */
  public get unsentQueueLength(): number {
    return this.unsentQueue.length;
  }

  /**
   * Число входящих дельт, ожидающих завершения инициализации (yjs.init).
   */
  public get liveQueueLength(): number {
    return this.liveQueue.length;
  }

  /**
   * Возвращает срез текущей очереди unsentQueue (для тестирования и мониторинга).
   */
  public getUnsentQueue(): ReadonlyArray<QueuedUpdate> {
    return this.unsentQueue;
  }

  /**
   * Возвращает срез текущей очереди liveQueue (для тестирования и мониторинга).
   */
  public getLiveQueue(): ReadonlyArray<Uint8Array> {
    return this.liveQueue;
  }

  /**
   * Переводит провайдер в статус INITIALIZING при установлении соединения/реконнекте.
   */
  public connect(): void {
    if (this.isDestroyed) return;
    if (this._status !== "INITIALIZING" && this._status !== "SYNCED") {
      this.transitionTo("INITIALIZING");
    }
  }

  /**
   * Переводит провайдер в статус DISCONNECTED при потере соединения.
   */
  public disconnect(): void {
    if (this.isDestroyed) return;
    if (this._status !== "DISCONNECTED") {
      this.transitionTo("DISCONNECTED");
    }
  }

  /**
   * Безопасный переход между состояниями с вызовом onStatusChange.
   */
  private transitionTo(newStatus: ProviderStatus): void {
    if (this._status === newStatus || this.isDestroyed) {
      return;
    }
    this._status = newStatus;
    this.onStatusChange?.(newStatus);
  }

  /**
   * Отправляет конверт через предоставленный sendEnvelopeFn или напрямую в сокет.
   */
  private sendEnvelope(envelope: AnyWebSocketEnvelope): void {
    if (this.sendEnvelopeFn) {
      this.sendEnvelopeFn(envelope);
    } else if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(envelope));
    }
  }

  /**
   * Отправляет дельту обновления в сокет в виде конверта yjs.update.
   */
  private sendUpdate(updateId: string, update: Uint8Array): void {
    const base64Data = uint8ArrayToBase64(update);

    const envelope: BaseWebSocketEnvelope<"yjs.update", YjsUpdatePayload> = {
      type: "yjs.update",
      version: 1,
      sessionId: this.sessionId,
      requestId: `req_${updateId}`,
      timestamp: new Date().toISOString(),
      payload: {
        taskKey: this.taskKey,
        updateId,
        data: base64Data,
      },
    };

    this.sendEnvelope(envelope as AnyWebSocketEnvelope);
  }

  /**
   * Обязательный контракт повторной отправки очереди unsentQueue при реконнекте (T025: Unsent Queue Drain Contract).
   *
   * 1. Фиксирует срез неподтвержденных дельт `unackedBatch = unsentQueue.slice()`.
   * 2. Объединяет через `Y.mergeUpdates` с генерацией `batchUpdateId` и сохранением маппинга.
   * 3. Любые новые локальные правки во время ожидания ACK добавляются строго в хвост unsentQueue.
   * 4. Удаляет элементы среза строго по получению ACK батча.
   */
  public drainUnsentQueue(): void {
    if (
      this.isDestroyed ||
      this._status !== "SYNCED" ||
      this.unsentQueue.length === 0
    ) {
      return;
    }

    const unackedBatch = this.unsentQueue.slice();
    if (unackedBatch.length === 0) {
      return;
    }

    if (unackedBatch.length === 1) {
      const item = unackedBatch[0];
      this.sendUpdate(item.updateId, item.data);
      return;
    }

    try {
      const mergedData = Y.mergeUpdates(unackedBatch.map((item) => item.data));
      // Проверяем лимит размера пакета 64 КБ (65536 байт)
      if (mergedData.byteLength <= 65536) {
        const batchUpdateId = `${this.providerId}:batch_${++this.seq}`;
        const originalIds = new Set(unackedBatch.map((item) => item.updateId));
        this.batchMap.set(batchUpdateId, originalIds);
        this.sendUpdate(batchUpdateId, mergedData);
      } else {
        // Если размер объединенных дельт превышает 64 КБ, отправляем по отдельности
        for (const item of unackedBatch) {
          this.sendUpdate(item.updateId, item.data);
        }
      }
    } catch (err) {
      console.error(
        `[RealtimeYjsProvider] Failed to merge updates in drainUnsentQueue:`,
        err,
      );
      for (const item of unackedBatch) {
        this.sendUpdate(item.updateId, item.data);
      }
    }
  }

  /**
   * Обрабатывает получение Ingress ACK от сервера (T024, T025, T027).
   * Удаляет дельту из очереди строго при получении соответствующего подтверждения.
   */
  private handleAck(updateId: string): void {
    // 1. Проверяем, является ли updateId идентификатором батча
    const batchedIds = this.batchMap.get(updateId);
    if (batchedIds) {
      this.batchMap.delete(updateId);
      this.unsentQueue = this.unsentQueue.filter(
        (item) => !batchedIds.has(item.updateId),
      );
      return;
    }

    // 2. Проверяем точное совпадение с updateId единичного обновления
    const index = this.unsentQueue.findIndex(
      (item) => item.updateId === updateId,
    );
    if (index !== -1) {
      this.unsentQueue.splice(index, 1);
      // Также удаляем из батч-мап, если присутствовал
      for (const [batchId, idSet] of this.batchMap.entries()) {
        if (idSet.has(updateId)) {
          idSet.delete(updateId);
          if (idSet.size === 0) {
            this.batchMap.delete(batchId);
          }
        }
      }
    }
  }

  /**
   * Отправляет локальные изменения Awareness в сокет в виде конверта yjs.awareness (T019).
   */
  private sendAwareness(update: Uint8Array): void {
    const base64Data = uint8ArrayToBase64(update);

    const envelope: BaseWebSocketEnvelope<
      "yjs.awareness",
      YjsAwarenessPayload
    > = {
      type: "yjs.awareness",
      version: 1,
      sessionId: this.sessionId,
      requestId: `req_aw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      payload: {
        taskKey: this.taskKey,
        data: base64Data,
      },
    };

    this.sendEnvelope(envelope as AnyWebSocketEnvelope);
  }

  /**
   * Обрабатывает входящий конверт WebSocket от сервера.
   * Может вызываться напрямую из общего WebSocket-диспетчера сессии.
   */
  public handleMessage(envelope: AnyWebSocketEnvelope): void {
    if (this.isDestroyed || !envelope) {
      return;
    }

    if (envelope.sessionId && envelope.sessionId !== this.sessionId) {
      return;
    }

    switch (envelope.type) {
      case "yjs.update": {
        const payload = envelope.payload as YjsUpdatePayload | undefined;
        if (!payload || payload.taskKey !== this.taskKey || !payload.data) {
          return;
        }

        try {
          const binary = base64ToUint8Array(payload.data);

          // T026: Если провайдер еще не синхронизирован (INITIALIZING или DISCONNECTED),
          // входящие удаленные дельты буферизуются в liveQueue!
          if (
            this._status === "INITIALIZING" ||
            this._status === "DISCONNECTED"
          ) {
            if (this.liveQueue.length >= MAX_LIVE_QUEUE_SIZE) {
              const err = new Error(
                `SyncError: live queue overflow (>${MAX_LIVE_QUEUE_SIZE})`,
              );
              this.liveQueue = [];
              this.transitionTo("ERROR");
              this.onError?.(err);
              return;
            }
            this.liveQueue.push(binary);
            return;
          }

          // Применяем с origin = this, чтобы наш doc.on('update') не ретранслировал обратно (T017, T025)
          Y.applyUpdate(this.doc, binary, this);
        } catch (err) {
          console.error(
            `[RealtimeYjsProvider] Failed to apply yjs.update for task ${this.taskKey}:`,
            err,
          );
        }
        break;
      }

      case "yjs.init": {
        const payload = envelope.payload as YjsInitPayload | undefined;
        if (!payload || payload.taskKey !== this.taskKey) {
          return;
        }

        // T026: Строго синхронный цикл накатки истории и опустошения liveQueue
        // в рамках одного тика Event Loop
        if (Array.isArray(payload.updates)) {
          for (const base64Update of payload.updates) {
            try {
              const binary = base64ToUint8Array(base64Update);
              Y.applyUpdate(this.doc, binary, this);
            } catch (err) {
              console.error(
                `[RealtimeYjsProvider] Failed to apply yjs.init update for task ${this.taskKey}:`,
                err,
              );
            }
          }
        }

        // Синхронный drain liveQueue
        while (this.liveQueue.length > 0) {
          const liveUpdate = this.liveQueue.shift();
          if (!liveUpdate) {
            break;
          }
          try {
            Y.applyUpdate(this.doc, liveUpdate, this);
          } catch (err) {
            console.error(
              `[RealtimeYjsProvider] Failed to apply liveQueue update for task ${this.taskKey}:`,
              err,
            );
          }
        }

        // Переводим провайдер в статус SYNCED
        this.transitionTo("SYNCED");
        this.onSynced?.();

        // T025: После перехода в SYNCED выполняем drain накопленных локальных unsent updates
        this.drainUnsentQueue();

        // Транслируем актуальное состояние Awareness новому участнику / комнате
        const localState = this.awareness.getLocalState();
        if (localState && Object.keys(localState).length > 0) {
          const update = encodeAwarenessUpdate(this.awareness, [
            this.doc.clientID,
          ]);
          this.sendAwareness(update);
        }
        break;
      }

      case "yjs.ack": {
        const payload = envelope.payload as YjsAckPayload | undefined;
        if (!payload || payload.taskKey !== this.taskKey || !payload.updateId) {
          return;
        }
        this.handleAck(payload.updateId);
        break;
      }

      case "room.sync": {
        // При переподключении комнаты (reconnect) сервер шлет room.sync
        if (this._status !== "INITIALIZING") {
          this.liveQueue = [];
          this.transitionTo("INITIALIZING");
        }
        break;
      }

      case "room.error": {
        const payload = envelope.payload as RoomErrorPayload | undefined;
        if (!payload || (payload.taskKey && payload.taskKey !== this.taskKey)) {
          return;
        }
        if (payload.code === "SYNC_FAILED") {
          const err = new Error(
            `SYNC_FAILED: ${payload.message || "Failed to sync room"}`,
          );
          this.transitionTo("ERROR");
          this.onError?.(err);
        }
        break;
      }

      case "yjs.awareness": {
        const payload = envelope.payload as YjsAwarenessPayload | undefined;
        if (!payload || payload.taskKey !== this.taskKey || !payload.data) {
          return;
        }

        try {
          const binary = base64ToUint8Array(payload.data);
          // Применяем с origin = this, чтобы awarenessUpdateListener не ретранслировал обратно
          applyAwarenessUpdate(this.awareness, binary, this);
        } catch (err) {
          console.error(
            `[RealtimeYjsProvider] Failed to apply yjs.awareness for task ${this.taskKey}:`,
            err,
          );
        }
        break;
      }

      case "presence.join": {
        // При подключении нового участника транслируем наше актуальное состояние awareness
        const localState = this.awareness.getLocalState();
        if (localState && Object.keys(localState).length > 0) {
          const update = encodeAwarenessUpdate(this.awareness, [
            this.doc.clientID,
          ]);
          this.sendAwareness(update);
        }
        break;
      }

      case "presence.leave": {
        // Очистка присутствия при отключении участника (T022)
        const payload = envelope.payload as { userId?: string } | undefined;
        const userId = payload?.userId;
        if (userId) {
          const targetClients: number[] = [];
          this.awareness.getStates().forEach((state, clientID) => {
            const stateUser = (
              state as { user?: { userId?: string; id?: string } }
            )?.user;
            if (stateUser?.userId === userId || stateUser?.id === userId) {
              targetClients.push(clientID);
            }
          });
          if (targetClients.length > 0) {
            removeAwarenessStates(
              this.awareness,
              targetClients,
              "server-leave",
            );
          }
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Освобождает ресурсы, отписывается от doc, awareness и WebSocket.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.transitionTo("DISCONNECTED");
    this.isDestroyed = true;

    this.doc.off("update", this.updateListener);

    if (this.socket) {
      if (this.socketOpenListener) {
        this.socket.removeEventListener("open", this.socketOpenListener);
      }
      if (this.socketCloseListener) {
        this.socket.removeEventListener("close", this.socketCloseListener);
      }
      if (this.socketErrorListener) {
        this.socket.removeEventListener("error", this.socketErrorListener);
      }
      if (this.socketMessageListener) {
        this.socket.removeEventListener("message", this.socketMessageListener);
      }
    }

    this.awareness.off("update", this.awarenessUpdateListener);
    removeAwarenessStates(this.awareness, [this.doc.clientID], "local-destroy");
    if (this.ownsAwareness) {
      this.awareness.destroy();
    }

    this.unsentQueue = [];
    this.liveQueue = [];
    this.batchMap.clear();
  }
}
