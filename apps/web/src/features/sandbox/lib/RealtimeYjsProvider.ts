import type {
  AnyWebSocketEnvelope,
  BaseWebSocketEnvelope,
  RoomErrorPayload,
  TaskSwitchedPayload,
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

/**
 * Изолированный контекст состояния задачи (T029).
 */
export interface TaskContext {
  taskKey: string;
  doc: Y.Doc;
  awareness: Awareness;
  ownsDoc: boolean;
  ownsAwareness: boolean;
  status: ProviderStatus;
  unsentQueue: QueuedUpdate[];
  liveQueue: Uint8Array[];
  batchMap: Map<string, Set<string>>; // batchUpdateId -> Set<originalUpdateId>
  updateListener: (update: Uint8Array, origin: unknown) => void;
  awarenessUpdateListener: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => void;
}

export interface RealtimeYjsProviderOptions {
  /** Опциональный начальный документ (для обратной совместимости) */
  doc?: Y.Doc;
  /** Опциональный начальный taskKey (по умолчанию "default:typescript") */
  taskKey?: string;
  sessionId: string;
  /** Опциональный инстанс Awareness для начальной задачи */
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
  onStatusChange?: (status: ProviderStatus, taskKey?: string) => void;
  /** Колбэк при успешном переходе в статус SYNCED */
  onSynced?: (taskKey?: string) => void;
}

/**
 * RealtimeYjsProvider (Phase 1–6: T017, T019, T022, T024–T029)
 *
 * Отвечает за:
 * 1. Изоляцию CRDT-документов по taskKey (вида `<taskId>:<lang>`) (T029).
 * 2. Изолированные инстансы Y.Doc, Y.Text и Awareness для каждой задачи (T029, T031).
 * 3. Раздельные очереди unsentQueue[taskKey] и liveQueue[taskKey] (T029).
 * 4. Подписку на локальные doc.on('update') и буферизацию в unsentQueue[taskKey] (T024, T029).
 * 5. Удержание дельт в unsentQueue[taskKey] до получения Ingress ACK (yjs.ack) (T024).
 * 6. Контракт повторной отправки очереди unsentQueue при реконнекте (Unsent Queue Drain Contract)
 *    с батчингом через Y.mergeUpdates строго по taskKey (T025, T029).
 * 7. Буферизацию входящих дельт в liveQueue[taskKey] при статусе INITIALIZING и строго синхронный
 *    цикл накатки истории и опустошения liveQueue при получении yjs.init (T026, T029).
 * 8. Контроль переполнения очередей (MAX_LIVE_QUEUE_SIZE, MAX_UNSENT_QUEUE_SIZE) с переходом в ERROR.
 * 9. Фильтрацию собственных обновлений (origin === this) для полного исключения сетевых петель.
 * 10. Протокол Awareness (T019, T031): трансляция кареток и выделений изолированно по taskKey.
 * 11. Очистка присутствия (T022): обработка presence.leave во всех контекстах задач.
 */
export class RealtimeYjsProvider {
  public readonly sessionId: string;

  private readonly socket: WebSocket | null;
  private readonly sendEnvelopeFn?: (envelope: AnyWebSocketEnvelope) => void;
  private readonly onError?: (error: Error) => void;
  private readonly onStatusChange?: (
    status: ProviderStatus,
    taskKey?: string,
  ) => void;
  private readonly onSynced?: (taskKey?: string) => void;
  private readonly user?: {
    userId?: string;
    id?: string;
    name?: string;
    color?: string;
    [key: string]: unknown;
  };
  private readonly initialStatus?: ProviderStatus;

  private seq = 0;
  private readonly providerId: string;
  private isDestroyed = false;

  private activeTaskKey: string;
  private readonly tasks = new Map<string, TaskContext>();

  private readonly socketOpenListener?: () => void;
  private readonly socketCloseListener?: () => void;
  private readonly socketErrorListener?: () => void;
  private readonly socketMessageListener?: (event: MessageEvent) => void;

  constructor(options: RealtimeYjsProviderOptions) {
    this.sessionId = options.sessionId;
    this.socket = options.socket ?? null;
    this.sendEnvelopeFn = options.sendEnvelope;
    this.onError = options.onError;
    this.onStatusChange = options.onStatusChange;
    this.onSynced = options.onSynced;
    this.user = options.user;
    this.initialStatus = options.initialStatus;
    this.providerId = `client_${Math.random().toString(36).substring(2, 9)}`;

    const initialKey = options.taskKey ?? "default:typescript";
    this.activeTaskKey = initialKey;

    // Инициализируем начальную задачу (с поддержкой переданного doc/awareness)
    this.getOrCreateTask(initialKey, options.doc, options.awareness);

    // Слушатели событий WebSocket (если передан сырой WebSocket)
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
   * Получает или создает изолированный контекст для указанного taskKey (T029).
   */
  public getOrCreateTask(
    taskKey: string,
    existingDoc?: Y.Doc,
    existingAwareness?: Awareness,
  ): TaskContext {
    let context = this.tasks.get(taskKey);
    if (context) {
      return context;
    }

    const ownsDoc = !existingDoc;
    const doc = existingDoc ?? new Y.Doc();

    const ownsAwareness = !existingAwareness;
    const awareness = existingAwareness ?? new Awareness(doc);

    // Определение статуса для новой задачи
    let status: ProviderStatus;
    if (this.initialStatus) {
      status = this.initialStatus;
    } else if (this.socket) {
      status =
        this.socket.readyState === WebSocket.OPEN
          ? "INITIALIZING"
          : "DISCONNECTED";
    } else {
      status = "SYNCED";
    }

    const unsentQueue: QueuedUpdate[] = [];
    const liveQueue: Uint8Array[] = [];
    const batchMap = new Map<string, Set<string>>();

    // 1. Слушатель локальных изменений Y.Doc для этого taskKey (T017, T024, T029)
    const updateListener = (update: Uint8Array, origin: unknown) => {
      // Игнорируем сетевые обновления и вызовы после уничтожения
      if (origin === this || this.isDestroyed) {
        return;
      }

      const currentTask = this.tasks.get(taskKey);
      if (!currentTask) {
        return;
      }

      if (currentTask.unsentQueue.length >= MAX_UNSENT_QUEUE_SIZE) {
        const err = new Error(
          `SyncError: unsent queue limit exceeded (${MAX_UNSENT_QUEUE_SIZE}) for task ${taskKey}`,
        );
        this.transitionTaskTo(taskKey, "ERROR");
        this.onError?.(err);
        return;
      }

      const updateId = `${this.providerId}:${++this.seq}`;
      const queuedItem: QueuedUpdate = { updateId, data: update };
      currentTask.unsentQueue.push(queuedItem);

      // При статусе SYNCED отправляем немедленно в сокет (T024, T029)
      if (currentTask.status === "SYNCED") {
        this.sendUpdate(taskKey, updateId, update);
      }
    };
    doc.on("update", updateListener);

    // 2. Слушатель изменений Awareness для этого taskKey (T019, T029, T031)
    const awarenessUpdateListener = (
      {
        added,
        updated,
        removed,
      }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === this || this.isDestroyed) {
        return;
      }
      const changedClients = added.concat(updated, removed);
      if (changedClients.length === 0) {
        return;
      }
      const update = encodeAwarenessUpdate(awareness, changedClients);
      this.sendAwareness(taskKey, update);
    };
    awareness.on("update", awarenessUpdateListener);

    context = {
      taskKey,
      doc,
      awareness,
      ownsDoc,
      ownsAwareness,
      status,
      unsentQueue,
      liveQueue,
      batchMap,
      updateListener,
      awarenessUpdateListener,
    };

    this.tasks.set(taskKey, context);

    if (this.user) {
      awareness.setLocalStateField("user", this.user);
    }

    return context;
  }

  /**
   * Переключает активную задачу и возвращает ее изолированный контекст (T029, T031).
   */
  public switchTask(newTaskKey: string): TaskContext {
    if (this.activeTaskKey && this.activeTaskKey !== newTaskKey) {
      const prevContext = this.tasks.get(this.activeTaskKey);
      if (prevContext) {
        prevContext.awareness.setLocalState(null);
      }
    }
    this.activeTaskKey = newTaskKey;
    const context = this.getOrCreateTask(newTaskKey);

    // Если соединение уже открыто, переводим новую задачу в INITIALIZING при первом входе
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (context.status === "DISCONNECTED") {
        this.transitionTaskTo(newTaskKey, "INITIALIZING");
      }
    }

    return context;
  }

  /**
   * Возвращает активный taskKey.
   */
  public get taskKey(): string {
    return this.activeTaskKey;
  }

  /**
   * Возвращает Y.Doc активной задачи (для обратной совместимости).
   */
  public get doc(): Y.Doc {
    return this.getDoc(this.activeTaskKey);
  }

  /**
   * Возвращает Awareness активной задачи (для обратной совместимости).
   */
  public get awareness(): Awareness {
    return this.getAwareness(this.activeTaskKey);
  }

  /**
   * Возвращает текущий статус активной задачи.
   */
  public get status(): ProviderStatus {
    return this.getTaskStatus(this.activeTaskKey);
  }

  /**
   * Возвращает true, если активная задача полностью синхронизирована с сервером.
   */
  public get isSynced(): boolean {
    return this.status === "SYNCED";
  }

  /**
   * Число неотправленных дельт в очереди активной задачи.
   */
  public get unsentQueueLength(): number {
    return this.getUnsentQueue(this.activeTaskKey).length;
  }

  /**
   * Число входящих дельт в liveQueue активной задачи.
   */
  public get liveQueueLength(): number {
    return this.getLiveQueue(this.activeTaskKey).length;
  }

  /**
   * Возвращает Y.Doc для запрошенного taskKey (или активной задачи).
   */
  public getDoc(taskKey: string = this.activeTaskKey): Y.Doc {
    return this.getOrCreateTask(taskKey).doc;
  }

  /**
   * Возвращает Y.Text для запрошенного taskKey.
   */
  public getText(
    taskKey: string = this.activeTaskKey,
    name = "monaco",
  ): Y.Text {
    return this.getDoc(taskKey).getText(name);
  }

  /**
   * Возвращает Awareness для запрошенного taskKey.
   */
  public getAwareness(taskKey: string = this.activeTaskKey): Awareness {
    return this.getOrCreateTask(taskKey).awareness;
  }

  /**
   * Возвращает статус синхронизации для запрошенного taskKey.
   */
  public getTaskStatus(taskKey: string = this.activeTaskKey): ProviderStatus {
    const task = this.tasks.get(taskKey);
    return task ? task.status : "DISCONNECTED";
  }

  /**
   * Возвращает срез текущей очереди unsentQueue для taskKey.
   */
  public getUnsentQueue(
    taskKey: string = this.activeTaskKey,
  ): ReadonlyArray<QueuedUpdate> {
    const task = this.tasks.get(taskKey);
    return task ? task.unsentQueue : [];
  }

  /**
   * Возвращает срез текущей очереди liveQueue для taskKey.
   */
  public getLiveQueue(
    taskKey: string = this.activeTaskKey,
  ): ReadonlyArray<Uint8Array> {
    const task = this.tasks.get(taskKey);
    return task ? task.liveQueue : [];
  }

  /**
   * Возвращает список всех зарегистрированных taskKey.
   */
  public getAllTaskKeys(): string[] {
    return Array.from(this.tasks.keys());
  }

  /**
   * Переводит контекст конкретной задачи в новый статус.
   */
  private transitionTaskTo(taskKey: string, newStatus: ProviderStatus): void {
    const task = this.tasks.get(taskKey);
    if (!task || task.status === newStatus || this.isDestroyed) {
      return;
    }
    task.status = newStatus;
    this.onStatusChange?.(newStatus, taskKey);
  }

  /**
   * Переводит все задачи в статус INITIALIZING при установлении соединения/реконнекте.
   */
  public connect(): void {
    if (this.isDestroyed) return;
    for (const [taskKey, task] of this.tasks.entries()) {
      if (task.status !== "INITIALIZING") {
        this.transitionTaskTo(taskKey, "INITIALIZING");
      }
    }
  }

  /**
   * Переводит все задачи в статус DISCONNECTED при потере соединения.
   */
  public disconnect(): void {
    if (this.isDestroyed) return;
    for (const [taskKey, task] of this.tasks.entries()) {
      task.liveQueue = [];
      if (task.status !== "DISCONNECTED") {
        this.transitionTaskTo(taskKey, "DISCONNECTED");
      }
    }
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
   * Отправляет дельту обновления в сокет с обязательным taskKey (T017, T029).
   */
  private sendUpdate(
    taskKey: string,
    updateId: string,
    update: Uint8Array,
  ): void {
    if (update.byteLength > 65536) {
      const err = new Error(
        `UpdateSizeError: Yjs update (${update.byteLength} bytes) exceeds maximum allowed size (64KB) for task ${taskKey}`,
      );
      this.onError?.(err);
      return;
    }

    const base64Data = uint8ArrayToBase64(update);

    const envelope: BaseWebSocketEnvelope<"yjs.update", YjsUpdatePayload> = {
      type: "yjs.update",
      version: 1,
      sessionId: this.sessionId,
      requestId: `req_${updateId}`,
      timestamp: new Date().toISOString(),
      payload: {
        taskKey,
        updateId,
        data: base64Data,
      },
    };

    this.sendEnvelope(envelope as AnyWebSocketEnvelope);
  }

  /**
   * Обязательный контракт повторной отправки очереди unsentQueue при реконнекте (T025, T029: Unsent Queue Drain Contract).
   * Работает изолированно для указанного taskKey (или для всех синхронизированных задач).
   */
  public drainUnsentQueue(targetTaskKey?: string): void {
    if (this.isDestroyed) {
      return;
    }

    const taskKeys = targetTaskKey
      ? [targetTaskKey]
      : Array.from(this.tasks.keys());

    for (const key of taskKeys) {
      const task = this.tasks.get(key);
      if (!task || task.status !== "SYNCED" || task.unsentQueue.length === 0) {
        continue;
      }

      const unackedBatch = task.unsentQueue.slice();
      if (unackedBatch.length === 0) {
        continue;
      }

      if (unackedBatch.length === 1) {
        const item = unackedBatch[0];
        this.sendUpdate(key, item.updateId, item.data);
        continue;
      }

      try {
        const mergedData = Y.mergeUpdates(
          unackedBatch.map((item) => item.data),
        );
        // Проверяем лимит размера пакета 64 КБ (65536 байт)
        if (mergedData.byteLength <= 65536) {
          const batchUpdateId = `${this.providerId}:batch_${++this.seq}`;
          const originalIds = new Set(
            unackedBatch.map((item) => item.updateId),
          );
          task.batchMap.set(batchUpdateId, originalIds);
          this.sendUpdate(key, batchUpdateId, mergedData);
        } else {
          // Если размер превышает 64 КБ, отправляем элементы по отдельности
          for (const item of unackedBatch) {
            this.sendUpdate(key, item.updateId, item.data);
          }
        }
      } catch (err) {
        console.error(
          `[RealtimeYjsProvider] Failed to merge updates in drainUnsentQueue for task ${key}:`,
          err,
        );
        for (const item of unackedBatch) {
          this.sendUpdate(key, item.updateId, item.data);
        }
      }
    }
  }

  /**
   * Обрабатывает получение Ingress ACK от сервера для конкретного taskKey (T024, T025, T029).
   */
  private handleAck(taskKey: string, updateId: string): void {
    const task = this.tasks.get(taskKey);
    if (!task) return;

    // 1. Проверяем, является ли updateId идентификатором батча
    const batchedIds = task.batchMap.get(updateId);
    if (batchedIds) {
      task.batchMap.delete(updateId);
      for (let i = task.unsentQueue.length - 1; i >= 0; i--) {
        if (batchedIds.has(task.unsentQueue[i].updateId)) {
          task.unsentQueue.splice(i, 1);
        }
      }
      return;
    }

    // 2. Проверяем точное совпадение с updateId единичного обновления
    const index = task.unsentQueue.findIndex(
      (item) => item.updateId === updateId,
    );
    if (index !== -1) {
      task.unsentQueue.splice(index, 1);
      // Удаляем из батч-мап при необходимости
      for (const [batchId, idSet] of task.batchMap.entries()) {
        if (idSet.has(updateId)) {
          idSet.delete(updateId);
          if (idSet.size === 0) {
            task.batchMap.delete(batchId);
          }
        }
      }
    }
  }

  /**
   * Отправляет локальные изменения Awareness в сокет с taskKey (T019, T029).
   */
  private sendAwareness(taskKey: string, update: Uint8Array): void {
    const task = this.tasks.get(taskKey);
    if (!task || task.status === "DISCONNECTED") {
      return;
    }

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
        taskKey,
        data: base64Data,
      },
    };

    this.sendEnvelope(envelope as AnyWebSocketEnvelope);
  }

  /**
   * Обрабатывает входящий конверт WebSocket от сервера с динамической маршрутизацией по taskKey (T029).
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
        if (!payload || !payload.taskKey || !payload.data) {
          return;
        }

        const taskContext = this.getOrCreateTask(payload.taskKey);

        try {
          const binary = base64ToUint8Array(payload.data);

          // T026: Буферизация в liveQueue при INITIALIZING / DISCONNECTED
          if (
            taskContext.status === "INITIALIZING" ||
            taskContext.status === "DISCONNECTED"
          ) {
            if (taskContext.liveQueue.length >= MAX_LIVE_QUEUE_SIZE) {
              const err = new Error(
                `SyncError: live queue overflow (>${MAX_LIVE_QUEUE_SIZE}) for task ${payload.taskKey}`,
              );
              taskContext.liveQueue = [];
              this.transitionTaskTo(payload.taskKey, "ERROR");
              this.onError?.(err);
              return;
            }
            taskContext.liveQueue.push(binary);
            return;
          }

          // Применяем обновление строго к Y.Doc целевой задачи с origin = this (T017, T029)
          Y.applyUpdate(taskContext.doc, binary, this);
        } catch (err) {
          console.error(
            `[RealtimeYjsProvider] Failed to apply yjs.update for task ${payload.taskKey}:`,
            err,
          );
        }
        break;
      }

      case "yjs.init": {
        const payload = envelope.payload as YjsInitPayload | undefined;
        if (!payload || !payload.taskKey) {
          return;
        }

        const taskContext = this.getOrCreateTask(payload.taskKey);

        // T026: Синхронный цикл накатки истории и опустошения liveQueue в рамках одного тика Event Loop
        if (Array.isArray(payload.updates)) {
          for (const base64Update of payload.updates) {
            try {
              const binary = base64ToUint8Array(base64Update);
              Y.applyUpdate(taskContext.doc, binary, this);
            } catch (err) {
              console.error(
                `[RealtimeYjsProvider] Failed to apply yjs.init update for task ${payload.taskKey}:`,
                err,
              );
            }
          }
        }

        // Синхронный drain liveQueue для этой задачи
        while (taskContext.liveQueue.length > 0) {
          const liveUpdate = taskContext.liveQueue.shift();
          if (!liveUpdate) break;
          try {
            Y.applyUpdate(taskContext.doc, liveUpdate, this);
          } catch (err) {
            console.error(
              `[RealtimeYjsProvider] Failed to apply liveQueue update for task ${payload.taskKey}:`,
              err,
            );
          }
        }

        // Переводим задачу в статус SYNCED
        this.transitionTaskTo(payload.taskKey, "SYNCED");
        this.onSynced?.(payload.taskKey);

        // T025: После перехода в SYNCED выполняем drain очереди неподтвержденных дельт этой задачи
        this.drainUnsentQueue(payload.taskKey);

        // Транслируем актуальное состояние Awareness новому участнику
        const localState = taskContext.awareness.getLocalState();
        if (localState && Object.keys(localState).length > 0) {
          const update = encodeAwarenessUpdate(taskContext.awareness, [
            taskContext.doc.clientID,
          ]);
          this.sendAwareness(payload.taskKey, update);
        }
        break;
      }

      case "yjs.ack": {
        const payload = envelope.payload as YjsAckPayload | undefined;
        if (!payload || !payload.taskKey || !payload.updateId) {
          return;
        }
        this.handleAck(payload.taskKey, payload.updateId);
        break;
      }

      case "task.switched": {
        const payload = envelope.payload as TaskSwitchedPayload | undefined;
        if (payload?.taskKey) {
          this.switchTask(payload.taskKey);
        }
        break;
      }

      case "room.sync": {
        // При переподключении комнаты сервер шлет room.sync
        for (const [taskKey, task] of this.tasks.entries()) {
          if (task.status !== "INITIALIZING") {
            this.transitionTaskTo(taskKey, "INITIALIZING");
          }
        }
        break;
      }

      case "room.error": {
        const payload = envelope.payload as RoomErrorPayload | undefined;
        if (!payload) return;
        const targetTaskKey = payload.taskKey ?? this.activeTaskKey;
        if (payload.code === "SYNC_FAILED") {
          const err = new Error(
            `SYNC_FAILED: ${payload.message || "Failed to sync room"}`,
          );
          this.transitionTaskTo(targetTaskKey, "ERROR");
          this.onError?.(err);
        }
        break;
      }

      case "yjs.awareness": {
        const payload = envelope.payload as YjsAwarenessPayload | undefined;
        if (!payload || !payload.taskKey || !payload.data) {
          return;
        }

        const taskContext = this.getOrCreateTask(payload.taskKey);
        try {
          const binary = base64ToUint8Array(payload.data);
          applyAwarenessUpdate(taskContext.awareness, binary, this);
        } catch (err) {
          console.error(
            `[RealtimeYjsProvider] Failed to apply yjs.awareness for task ${payload.taskKey}:`,
            err,
          );
        }
        break;
      }

      case "presence.join": {
        // При подключении участника отправляем awareness для активной задачи
        const activeContext = this.tasks.get(this.activeTaskKey);
        if (activeContext) {
          const localState = activeContext.awareness.getLocalState();
          if (localState && Object.keys(localState).length > 0) {
            const update = encodeAwarenessUpdate(activeContext.awareness, [
              activeContext.doc.clientID,
            ]);
            this.sendAwareness(this.activeTaskKey, update);
          }
        }
        break;
      }

      case "presence.leave": {
        // Очистка присутствия при отключении участника во всех контекстах (T022, T029)
        const payload = envelope.payload as { userId?: string } | undefined;
        const userId = payload?.userId;
        if (userId) {
          for (const context of this.tasks.values()) {
            const targetClients: number[] = [];
            context.awareness.getStates().forEach((state, clientID) => {
              const stateUser = (
                state as { user?: { userId?: string; id?: string } }
              )?.user;
              if (stateUser?.userId === userId || stateUser?.id === userId) {
                targetClients.push(clientID);
              }
            });
            if (targetClients.length > 0) {
              removeAwarenessStates(
                context.awareness,
                targetClients,
                "server-leave",
              );
            }
          }
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Освобождает ресурсы всех контекстов задач и сокета.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    for (const context of this.tasks.values()) {
      context.status = "DISCONNECTED";
      context.doc.off("update", context.updateListener);
      context.awareness.off("update", context.awarenessUpdateListener);
      removeAwarenessStates(
        context.awareness,
        [context.doc.clientID],
        "local-destroy",
      );
      if (context.ownsAwareness) {
        context.awareness.destroy();
      }
      if (context.ownsDoc) {
        context.doc.destroy();
      }
      context.unsentQueue.length = 0;
      context.liveQueue = [];
      context.batchMap.clear();
    }
    this.tasks.clear();

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
  }
}
