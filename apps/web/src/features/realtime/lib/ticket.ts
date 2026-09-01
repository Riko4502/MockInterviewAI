import { AuthError, baseFetch } from "@/shared/api/base";
import { endpoints, realtimeWsUrl } from "@/shared/api/endpoints";

/** Максимум последовательных failed handshake (403 при апгрейде) до остановки reconnect. */
export const MAX_HANDSHAKE_FAILURES = 5;
/** Начальная задержка экспоненциального backoff reconnect (мс). */
export const RECONNECT_BASE_DELAY_MS = 1_000;
/** Верхняя граница задержки reconnect (мс). */
export const RECONNECT_MAX_DELAY_MS = 30_000;

/** Коды закрытия WebSocket, после которых auto-reconnect не выполняется (P6). */
const RECONNECT_FORBIDDEN_CODES = new Set([1001, 1008]);

export interface RealtimeSocketOptions {
  /** Вызывается на каждое сообщение от сервера; переживает реконнекты. */
  onMessage?: (event: MessageEvent) => void;
  /**
   * Вызывается при окончательном закрытии соединения без дальнейших
   * попыток reconnect: код 1008 (evict), 1001 (уход вкладки) или
   * исчерпан лимит handshake-отказов.
   */
  onClose?: (event: CloseEvent) => void;
}

export interface RealtimeConnection {
  /** Текущий (активный) WebSocket. Заменяется после каждого reconnect. */
  socket: WebSocket;
  /** Закрывает соединение и отменяет все планируемые reconnect. */
  close: () => void;
}

/**
 * Получает одноразовый тикет для подключения к комнате интервью-сессии.
 *
 * Тикет НИКОГДА не сохраняется в sessionStorage и не логируется: это
 * одноразовая учётная запись для `Sec-WebSocket-Protocol`.
 */
export async function getTicket(sessionId: string): Promise<string> {
  const { ticket } = await baseFetch<{ ticket: string }>(
    endpoints.realtime.ticket,
    { method: "POST", body: JSON.stringify({ sessionId }) },
  );
  return ticket;
}

/**
 * Подключается к realtime-комнате сессии через WebSocket с аутентификацией
 * одноразовым тикетом (`Sec-WebSocket-Protocol: ["realtime", <ticket>]`).
 *
 * Auto-reconnect: повторный тикет + переподключение с экспоненциальным
 * backoff (1s → 30s) на нештатное закрытие или сетевое прерывание. На `close`
 * с кодом `1008` (evict) и `1001` (уход вкладки) reconnect НЕ выполняется.
 * Если более `MAX_HANDSHAKE_FAILURES` попыток подряд отброшены на этапе
 * handshake (403 — не член/закрытая сессия), reconnect останавливается:
 * повторный тикет не спасёт, auth-слой уведёт пользователя на `/login`.
 *
 * @throws {AuthError} Если первичный тикет не получен (403/401 от API —
 *   baseFetch уже сбросил токен и перенаправил на `/login`).
 */
export async function connectWebSocket(
  sessionId: string,
  options: RealtimeSocketOptions = {},
): Promise<RealtimeConnection> {
  const { onMessage, onClose } = options;

  const url = `${realtimeWsUrl}/ws/sessions/${encodeURIComponent(sessionId)}`;

  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelayMs = RECONNECT_BASE_DELAY_MS;
  let handshakeFailures = 0;
  let socketEverOpened = false;
  let closed = false;

  const connection: RealtimeConnection = {
    get socket(): WebSocket {
      if (!socket) {
        throw new Error("WebSocket is not established yet");
      }
      return socket;
    },
    close: closeConnection,
  };

  async function openSocket(): Promise<WebSocket | null> {
    let ticket: string;
    try {
      ticket = await getTicket(sessionId);
    } catch (error) {
      if (error instanceof AuthError) {
        // Отсутствует/истёк access token: baseFetch уже перенаправил
        // на /login. Reconnect бессмыслен. При первичном подключении
        // пробрасываем вызывающему; при реконнекте — тихо останавливаемся.
        closed = true;
        throw error;
      }
      throw error;
    }

    if (closed) {
      return null;
    }

    const ws = new WebSocket(url, ["realtime", ticket]);
    socket = ws;
    socketEverOpened = false;

    ws.addEventListener("open", () => {
      socketEverOpened = true;
    });

    ws.addEventListener("message", (event) => {
      onMessage?.(event);
    });

    ws.addEventListener("close", (event) => {
      if (closed) {
        return;
      }
      if (socket === ws) {
        socket = null;
      }

      if (RECONNECT_FORBIDDEN_CODES.has(event.code)) {
        closed = true;
        onClose?.(event);
        return;
      }

      // Отказ на этапе handshake (не достигли OPEN) — например 403
      // "not a member"/"session is closed". Повторный тикет не спасёт:
      // считаем попытки и останавливаемся после лимита.
      if (!socketEverOpened) {
        handshakeFailures += 1;
        if (handshakeFailures >= MAX_HANDSHAKE_FAILURES) {
          closed = true;
          onClose?.(event);
          return;
        }
      }

      scheduleReconnect();
    });

    return ws;
  }

  function scheduleReconnect(): void {
    if (closed || retryTimer !== null) {
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void openSocket().catch(() => {
        // Неудача получения тикета на реконнекте — пробуем снова.
        scheduleReconnect();
      });
    }, retryDelayMs);
    retryDelayMs = Math.min(retryDelayMs * 2, RECONNECT_MAX_DELAY_MS);
  }

  function closeConnection(): void {
    closed = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    const current = socket;
    socket = null;
    current?.close(1000, "client closed");
  }

  // Первое подключение: ошибка (AuthError / сеть / невалидный URL)
  // пробрасывается вызывающему.
  await openSocket();

  return connection;
}
