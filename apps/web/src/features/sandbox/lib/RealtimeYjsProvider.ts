import type {
  AnyWebSocketEnvelope,
  BaseWebSocketEnvelope,
  YjsUpdatePayload,
} from "@packages/dto";
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

export interface RealtimeYjsProviderOptions {
  doc: Y.Doc;
  taskKey: string;
  sessionId: string;
  /** Опциональный прямой WebSocket или кастомный transport sender */
  socket?: WebSocket | null;
  /** Опциональная функция отправки конверта через существующий сессионный сокет */
  sendEnvelope?: (envelope: AnyWebSocketEnvelope) => void;
}

/**
 * RealtimeYjsProvider (T017)
 * Базовый провайдер синхронизации Yjs CRDT через WebSocket сокет Go Relay.
 *
 * Отвечает за:
 * 1. Подписку на локальные doc.on('update') и отправку yjs.update в сокет.
 * 2. Применение входящих дельт yjs.update / yjs.init через Y.applyUpdate(doc, data, this).
 * 3. Фильтрацию собственных обновлений для предотвращения сетевых петель.
 * 4. Монотонные updateId и сериализацию Base64 согласно @packages/dto.
 */
export class RealtimeYjsProvider {
  public readonly doc: Y.Doc;
  public readonly taskKey: string;
  public readonly sessionId: string;

  private readonly socket: WebSocket | null;
  private readonly sendEnvelopeFn?: (envelope: AnyWebSocketEnvelope) => void;
  private seq = 0;
  private readonly providerId: string;
  private isDestroyed = false;

  private readonly updateListener: (
    update: Uint8Array,
    origin: unknown,
  ) => void;
  private readonly socketMessageListener: (event: MessageEvent) => void;

  constructor(options: RealtimeYjsProviderOptions) {
    this.doc = options.doc;
    this.taskKey = options.taskKey;
    this.sessionId = options.sessionId;
    this.socket = options.socket ?? null;
    this.sendEnvelopeFn = options.sendEnvelope;
    this.providerId = `client_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Слушатель локальных изменений Y.Doc
    this.updateListener = (update: Uint8Array, origin: unknown) => {
      // Игнорируем обновления, пришедшие от этого же провайдера из сети
      if (origin === this || this.isDestroyed) {
        return;
      }
      this.sendUpdate(update);
    };
    this.doc.on("update", this.updateListener);

    // 2. Слушатель входящих сообщений из WebSocket (если передан сырой сокет)
    this.socketMessageListener = (event: MessageEvent) => {
      if (this.isDestroyed) return;
      try {
        const rawData =
          typeof event.data === "string" ? event.data : event.data?.toString();
        if (!rawData) return;
        const envelope = JSON.parse(rawData) as AnyWebSocketEnvelope;
        this.handleMessage(envelope);
      } catch {
        // Игнорируем не-JSON сообщения
      }
    };

    if (this.socket) {
      this.socket.addEventListener("message", this.socketMessageListener);
    }
  }

  /**
   * Отправляет локальную дельту в WebSocket сокет в виде конверта yjs.update.
   */
  private sendUpdate(update: Uint8Array): void {
    const updateId = `${this.providerId}:${++this.seq}`;
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

    if (this.sendEnvelopeFn) {
      this.sendEnvelopeFn(envelope as AnyWebSocketEnvelope);
    } else if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(envelope));
    }
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
          // Применяем с origin = this, чтобы наш doc.on('update') не ретранслировал обратно
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
        const payload = envelope.payload as
          | { taskKey: string; updates: string[] }
          | undefined;
        if (!payload || payload.taskKey !== this.taskKey) {
          return;
        }

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
        break;
      }

      default:
        break;
    }
  }

  /**
   * Освобождает ресурсы, отписывается от doc и WebSocket.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.doc.off("update", this.updateListener);

    if (this.socket) {
      this.socket.removeEventListener("message", this.socketMessageListener);
    }
  }
}
