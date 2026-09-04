# SSE на фронтенде: практическое руководство (`/sse/notifications`)

Как подключиться к глобальному потоку уведомлений сервиса `apps/realtime`, обработать события, пережить обрывы связи и не потерять сообщения.

* **Справочник типов и контрактов** (payload'ы всех событий) — [realtime.md](./realtime.md), раздел 4.
* **Серверная архитектура** — [SSE_ARCHITECTURE.md](../../SSE_ARCHITECTURE.md), [SSE_SPEC.md](../../../apps/realtime/SSE_SPEC.md).
* **Комната интервью (WebSocket)** — это другой канал, см. [realtime.md](./realtime.md), раздел 3.

---

## 1. Что это и когда использовать

| | WebSocket `/ws/sessions/{id}` | SSE `/sse/notifications` |
|---|---|---|
| Область | одна комната интервью | весь аккаунт, любая страница |
| Направление | двунаправленный | **только сервер → клиент** |
| Живёт | пока открыта комната | всё время, пока пользователь залогинен |
| Отправка с клиента | да | **нет** — действия идут обычным REST |

SSE-поток открывается один раз на вкладку (в корневом провайдере) и работает как шина push-уведомлений: колокольчик, тосты, инвалидация кэша TanStack Query, баннеры техработ.

> **Правило:** SSE — это **сигнал**, а не источник данных. Событие говорит «что-то изменилось»; актуальное состояние берётся из REST/TanStack Query. Так интерфейс останется корректным, даже если событие потерялось или пришло дважды.

---

## 2. Подключение: почему нельзя использовать `EventSource`

Нативный `EventSource` в этом проекте **не подходит**:

1. Он не умеет ставить заголовки, а access-токен у нас лежит в `sessionStorage` и передаётся как `Authorization: Bearer` (см. [base.ts](../../../apps/web/src/shared/api/base.ts)). Cookie `access_token` API не выставляет — есть только `refresh_token`.
2. Передать токен в query string нельзя: сервер отвечает `400 Bad Request`, потому что query утекает в access-логи прокси, историю браузера и `Referer`.

Поэтому клиент строится на `fetch` + `ReadableStream`. Плюсом получаем то, чего у `EventSource` нет: собственный контроль реконнекта, ручную установку `Last-Event-ID` и чтение HTTP-статуса ошибки.

**Эндпоинт:** `GET {NEXT_PUBLIC_REALTIME_URL}/sse/notifications`

Обязательные атрибуты запроса:

```ts
fetch(url, {
  headers: {
    Accept: "text/event-stream",
    Authorization: `Bearer ${accessToken}`,
    // только при переподключении, если уже получали события с id
    "Last-Event-ID": lastEventId,
  },
  credentials: "include",
  cache: "no-store",
  signal: abortController.signal,
});
```

CORS на сервере настроен под это: origin отражается из белого списка `ALLOWED_ORIGINS`, `Access-Control-Allow-Credentials: true`, в `Allow-Headers` разрешены `Authorization`, `Cache-Control` и `Last-Event-ID`.

### 2.1. Переменная окружения

`NEXT_PUBLIC_REALTIME_URL` сейчас хранит **ws**-схему (`ws://localhost:8080`) и используется для WebSocket. Для SSE нужен http-origin того же сервиса — добавьте производный урл в [endpoints.ts](../../../apps/web/src/shared/api/endpoints.ts):

```ts
// apps/web/src/shared/api/endpoints.ts
export const realtimeWsUrl =
  process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:8080";

/** Тот же realtime-сервис по HTTP: используется для SSE-потока уведомлений. */
export const realtimeHttpUrl = realtimeWsUrl.replace(/^ws/, "http");

export const sseNotificationsUrl = `${realtimeHttpUrl}/sse/notifications`;
```

---

## 3. Формат кадров (wire protocol)

Сервер шлёт три вида кадров.

**Событие** — то, что нужно приложению:

```
event: notification.new
id: 1724500000000-0
data: {"id":"1724500000000-0","type":"notification.new","timestamp":"2026-09-04T10:00:00Z","payload":{...}}

```

**Комментарий (heartbeat)** — каждые **15 секунд**, держит соединение живым и пробивает буферы прокси. Игнорируется парсером, но полезен как признак «связь жива»:

```
: ping 1724500000000

```

**Retry** — один раз при открытии потока, рекомендованная пауза перед переподключением (по умолчанию `3000` мс):

```
retry: 3000

```

Важные детали:

* Кадр всегда завершается **пустой строкой** (`\n\n`) — парсер режет буфер именно по ней.
* `data` в JSON дублирует `type`, `id` и `timestamp` из заголовков кадра — можно парсить только `data`.
* Поле `id` есть **не у всех** событий. Его нет у `system.broadcast` (общесистемный бродкаст не лежит в персональном стриме) и у `auth.revoked`. **Не затирайте `lastEventId` пустым значением** — иначе сломаете Replay.

---

## 4. Типы событий

| `event:` | Когда приходит | Типичная реакция на фронте |
|---|---|---|
| `notification.new` | новое персональное уведомление | тост + добавить в список колокольчика |
| `notification.badge` | изменился счётчик непрочитанных | обновить бейдж (`unreadCount`) |
| `session.invited` | приглашение на интервью | тост с кнопкой «Присоединиться» (`joinUrl`) |
| `code_runner.status` | завершился прогон автотестов | обновить панель результатов, `invalidateQueries` |
| `ai.report_ready` | готов итоговый AI-отчёт | тост со ссылкой `reportUrl`, инвалидация отчётов |
| `account.updated` | изменился баланс кредитов / тариф | обновить хедер, `invalidateQueries(["account"])` |
| `system.broadcast` | алерт или окно техработ для всех | глобальный баннер |
| `auth.revoked` | авторизация отозвана | **не переподключаться**, разлогинить и увести на `/login` |

Payload'ы всех событий описаны в [realtime.md](./realtime.md), раздел 4 (источник правды на бэкенде — [payload.go](../../../apps/realtime/internal/sse/payload.go)).

---

## 5. Гарантии доставки и Replay

Доставка — **at-least-once**, порядок в рамках персонального стрима сохраняется.

* Каждое персональное событие пишется в Redis Stream пользователя (`XADD MAXLEN ~ 100`, TTL ключа — 7 дней). `id` события — это Redis Stream ID вида `1724500000000-0`.
* При переподключении клиент присылает `Last-Event-ID`, и сервер **дочитывает всю историю** после этого id страницами по 20 событий (предохранитель — 1000 событий за одну фазу Replay), затем переходит в живой режим.
* Дубликаты в рамках одного соединения сервер отсекает сам (события из Replay не повторяются в живой фазе). Но **между** переподключениями дубликат прийти может — обработчики обязаны быть идемпотентными.

Из этого следуют два правила для фронта:

1. **Храните `lastEventId` в памяти вкладки** (не в `localStorage` — у каждой вкладки свой курсор) и обновляйте его только когда `id` непустой.
2. **Глубина истории — ~100 событий, TTL 7 дней.** Если вкладка была офлайн долго, часть событий потеряна безвозвратно. Поэтому при успешном (пере)подключении делайте `invalidateQueries` по ключевым данным — REST добирает то, чего нет в стриме.

---

## 6. Коды ответов и что с ними делать

| Статус | Причина | Реакция клиента |
|---|---|---|
| `200` | поток открыт | читаем стрим |
| `400` | токен передан в query string | баг клиента, не ретраить |
| `401` | нет токена, токен истёк/отозван, сессия неактивна | **один** `POST /api/v1/auth/refresh`, затем переподключение с новым токеном; если refresh не удался — логаут |
| `429` | превышен лимит соединений (5 на пользователя, 20 на IP) | ждать `Retry-After` (30 с) и пробовать снова; см. §9 про вкладки |
| `503` | сервис выключается (graceful shutdown) | ждать `Retry-After`, затем обычный backoff |
| обрыв без статуса | сеть, прокси, «уснувшая» вкладка | реконнект с экспоненциальным backoff + jitter |

Сервер также сам закрывает поток, если клиент не успевает читать (буфер 128 событий переполнен дольше 30 секунд) — для фронта это выглядит как обычный обрыв. Причина обычно в тяжёлой синхронной работе в обработчике: не делайте в нём ничего блокирующего.

---

## 7. Референсная реализация

Слой FSD: `apps/web/src/shared/api/sse/`. Всё — client-only (`"use client"`), при SSR не выполняется.

### 7.1. Типы

Канонические типы SSE должны жить в `@packages/dto` (`packages/dto/src/realtime/`) — там же, где `ticket.dto.ts`. Пока их там нет, объявите локально и перенесите в пакет при первой же необходимости переиспользования.

```ts
// apps/web/src/shared/api/sse/types.ts
export interface BaseSSEEnvelope<TType extends string, TPayload> {
  /** Redis Stream ID. Отсутствует у system.broadcast и auth.revoked. */
  id?: string;
  type: TType;
  /** ISO 8601 */
  timestamp: string;
  payload: TPayload;
}

export type AnySSEEnvelope =
  | BaseSSEEnvelope<"notification.new", NotificationNewPayload>
  | BaseSSEEnvelope<"notification.badge", NotificationBadgePayload>
  | BaseSSEEnvelope<"session.invited", SessionInvitedPayload>
  | BaseSSEEnvelope<"code_runner.status", CodeRunnerStatusPayload>
  | BaseSSEEnvelope<"ai.report_ready", AIReportReadyPayload>
  | BaseSSEEnvelope<"account.updated", AccountUpdatedPayload>
  | BaseSSEEnvelope<"system.broadcast", SystemBroadcastPayload>
  | BaseSSEEnvelope<"auth.revoked", { reason: string }>;

export type SSEEventType = AnySSEEnvelope["type"];

export type SSEStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";
```

Дискриминированное объединение даёт автоматический вывод типа payload по `envelope.type` — приведения типов не нужны.

### 7.2. Парсер кадров

```ts
// apps/web/src/shared/api/sse/parser.ts
export interface ParsedFrame {
  /** Значение поля event: (по умолчанию "message") */
  event: string;
  /** Склеенные строки data: */
  data: string;
  /** Значение поля id:, если было */
  id?: string;
  /** Значение поля retry:, если было */
  retry?: number;
}

/**
 * Разбирает поток text/event-stream в кадры.
 * Комментарии (": ping ...") пропускаются, но обновляют время последнего байта —
 * вызывающий код использует это для детекта зависшего соединения.
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onActivity?: () => void,
): AsyncGenerator<ParsedFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;

      onActivity?.();
      buffer += decoder.decode(value, { stream: true });

      // Кадры разделены пустой строкой; \r\n нормализуем.
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const chunk = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);

        const frame = parseFrame(chunk);
        if (frame) yield frame;

        separator = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseFrame(chunk: string): ParsedFrame | null {
  let event = "message";
  let id: string | undefined;
  let retry: number | undefined;
  const dataLines: string[] = [];

  for (const line of chunk.split("\n")) {
    if (line === "" || line.startsWith(":")) continue; // комментарий/heartbeat

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // По спецификации W3C один пробел после двоеточия отбрасывается.
    const rawValue = colon === -1 ? "" : line.slice(colon + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    switch (field) {
      case "event":
        event = value;
        break;
      case "data":
        dataLines.push(value);
        break;
      case "id":
        id = value;
        break;
      case "retry": {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) retry = parsed;
        break;
      }
    }
  }

  if (dataLines.length === 0) return null; // кадр retry: без данных
  return { event, data: dataLines.join("\n"), id, retry };
}
```

### 7.3. Клиент с реконнектом

```ts
// apps/web/src/shared/api/sse/client.ts
import { sseNotificationsUrl } from "@/shared/api/endpoints";
import { parseSSEStream } from "./parser";
import type { AnySSEEnvelope, SSEStatus } from "./types";

const DEFAULT_RETRY_MS = 3000;
const MAX_RETRY_MS = 30_000;
/** Сервер шлёт heartbeat раз в 15 с: молчание дольше 45 с считаем обрывом. */
const STALL_TIMEOUT_MS = 45_000;

export interface SSEClientOptions {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
  onEvent: (envelope: AnySSEEnvelope) => void;
  onStatus?: (status: SSEStatus) => void;
  /** Вызывается после каждого успешного открытия потока: добор данных через REST. */
  onOpen?: () => void;
  /** Авторизация отозвана — переподключаться нельзя. */
  onRevoked?: (reason: string) => void;
}

export function createSSEClient(options: SSEClientOptions) {
  let controller: AbortController | null = null;
  let lastEventId: string | null = null;
  let retryMs = DEFAULT_RETRY_MS;
  let attempt = 0;
  let stopped = false;
  let refreshed = false;

  const setStatus = (status: SSEStatus) => options.onStatus?.(status);

  async function connect(): Promise<void> {
    while (!stopped) {
      controller = new AbortController();
      setStatus(attempt === 0 ? "connecting" : "reconnecting");

      try {
        const headers: Record<string, string> = {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        };

        const token = options.getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        if (lastEventId) headers["Last-Event-ID"] = lastEventId;

        const response = await fetch(sseNotificationsUrl, {
          headers,
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          // Access-токен протух: один шанс обновиться, иначе логаут.
          if (refreshed || !(await options.refreshAccessToken())) {
            stopped = true;
            setStatus("closed");
            options.onRevoked?.("unauthorized");
            return;
          }
          refreshed = true;
          continue;
        }

        if (response.status === 429 || response.status === 503) {
          const retryAfter =
            Number.parseInt(response.headers.get("Retry-After") ?? "", 10) || 30;
          await sleep(retryAfter * 1000);
          continue;
        }

        if (!response.ok || !response.body) {
          throw new Error(`SSE failed: HTTP ${response.status}`);
        }

        // Поток открыт: сбрасываем счётчики и добираем пропущенное через REST.
        attempt = 0;
        refreshed = false;
        retryMs = DEFAULT_RETRY_MS;
        setStatus("open");
        options.onOpen?.();

        await readStream(response.body, controller);
      } catch (error) {
        if (stopped || (error as Error).name === "AbortError") return;
      }

      if (stopped) return;

      attempt += 1;
      setStatus("reconnecting");
      await sleep(backoffDelay(retryMs, attempt));
    }
  }

  async function readStream(
    body: ReadableStream<Uint8Array>,
    ctrl: AbortController,
  ): Promise<void> {
    // Watchdog: если сервер замолчал (умер прокси, «уснула» вкладка) — рвём сами.
    let lastActivity = Date.now();
    const watchdog = setInterval(() => {
      if (Date.now() - lastActivity > STALL_TIMEOUT_MS) ctrl.abort();
    }, STALL_TIMEOUT_MS / 3);

    try {
      for await (const frame of parseSSEStream(body, () => {
        lastActivity = Date.now();
      })) {
        if (frame.retry) retryMs = frame.retry;

        let envelope: AnySSEEnvelope;
        try {
          envelope = JSON.parse(frame.data) as AnySSEEnvelope;
        } catch {
          continue; // битый кадр не должен ронять поток
        }

        // id есть не у всех событий — пустым значением курсор не затираем.
        if (frame.id) lastEventId = frame.id;

        if (envelope.type === "auth.revoked") {
          stopped = true;
          ctrl.abort();
          setStatus("closed");
          options.onRevoked?.(envelope.payload.reason);
          return;
        }

        options.onEvent(envelope);
      }
    } finally {
      clearInterval(watchdog);
    }
  }

  return {
    start() {
      if (controller) return;
      stopped = false;
      void connect();
    },
    stop() {
      stopped = true;
      controller?.abort();
      controller = null;
      setStatus("closed");
    },
  };
}

/** Экспоненциальный backoff с потолком и джиттером — чтобы вкладки не били залпом. */
function backoffDelay(base: number, attempt: number): number {
  const exponential = Math.min(base * 2 ** (attempt - 1), MAX_RETRY_MS);
  return exponential / 2 + Math.random() * (exponential / 2);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### 7.4. Провайдер

Поток должен быть **один на вкладку**. Поднимайте его рядом с `QueryProvider` в корневом layout.

```tsx
// apps/web/src/shared/api/sse/provider.tsx
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createSSEClient } from "./client";
import type { AnySSEEnvelope, SSEStatus } from "./types";

type Listener = (envelope: AnySSEEnvelope) => void;

export function SSEProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SSEStatus>("idle");
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    const client = createSSEClient({
      getAccessToken: () => sessionStorage.getItem("accessToken"),
      // переиспользуйте логику рефреша из shared/api/base.ts
      refreshAccessToken: tryRefreshToken,
      onStatus: setStatus,
      onOpen: () => {
        // Пропущенное за офлайн глубже ~100 событий Replay не вернёт —
        // добираем актуальное состояние из REST.
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["account"] });
      },
      onEvent: (envelope) => {
        for (const listener of listeners.current) listener(envelope);
      },
      onRevoked: () => {
        sessionStorage.removeItem("accessToken");
        window.location.href = "/login";
      },
    });

    client.start();
    return () => client.stop();
  }, [queryClient]);

  return (
    <SSEContext.Provider value={{ status, listeners: listeners.current }}>
      {children}
    </SSEContext.Provider>
  );
}
```

> **StrictMode:** в dev-режиме React монтирует эффекты дважды. `client.stop()` в cleanup обязателен — иначе на вкладку откроется два потока и лимит в 5 соединений израсходуется втрое быстрее.

### 7.5. Хук подписки

```ts
// apps/web/src/shared/api/sse/use-sse-event.ts
"use client";

import { useContext, useEffect, useRef } from "react";
import { SSEContext } from "./provider";
import type { AnySSEEnvelope, SSEEventType } from "./types";

type EnvelopeOf<T extends SSEEventType> = Extract<AnySSEEnvelope, { type: T }>;

/** Подписка на один тип SSE-события. Тип payload выводится автоматически. */
export function useSSEEvent<T extends SSEEventType>(
  type: T,
  handler: (envelope: EnvelopeOf<T>) => void,
): void {
  const { listeners } = useContext(SSEContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (envelope: AnySSEEnvelope) => {
      if (envelope.type === type) handlerRef.current(envelope as EnvelopeOf<T>);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [type, listeners]);
}
```

`handlerRef` нужен, чтобы подписка не пересоздавалась на каждый рендер из-за нестабильной ссылки на колбэк.

---

## 8. Использование в фичах

```tsx
// widgets/notification-bell/ui/notification-bell.tsx
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSSEEvent } from "@/shared/api/sse/use-sse-event";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [unread, setUnread] = useState(0);

  // payload типизирован как NotificationBadgePayload без приведения типов
  useSSEEvent("notification.badge", ({ payload }) => {
    setUnread(payload.unreadCount);
  });

  useSSEEvent("notification.new", ({ payload }) => {
    toast({ title: payload.title, description: payload.message });
    // Не дописываем элемент в кэш вручную: событие может продублироваться.
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  return <BellIcon count={unread} />;
}
```

Три паттерна реакции на событие:

1. **Инвалидация** (по умолчанию) — `invalidateQueries`, данные тянет REST. Идемпотентно, дубликаты безопасны.
2. **Локальный UI-эффект** — тост, баннер, звук. Если событие критично не показывать дважды, дедуплицируйте по `envelope.id` (или `payload.id`) через `Set` последних id.
3. **Прямая запись в кэш** (`setQueryData`) — только для абсолютных значений вроде `notification.badge`, где приходит итоговое число, а не инкремент.

---

## 9. Несколько вкладок

Сервер разрешает **5 одновременных соединений на пользователя** и 20 на IP. Шестая вкладка получит `429` с `Retry-After: 30`.

Для обычного сценария (2–3 вкладки) ничего делать не нужно. Если вкладок бывает больше, поднимайте поток только во вкладке-лидере: выбор лидера через `BroadcastChannel`, а события рассылайте остальным вкладкам тем же каналом. Это заодно снимает дублирование тостов сразу на всех вкладках.

---

## 10. Тестирование

Поток на `fetch` мокается без сети — достаточно подменить `global.fetch` ответом с `ReadableStream`:

```ts
// vitest
function sseResponse(frames: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

it("парсит событие и обновляет курсор", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    sseResponse([
      "retry: 3000\n\n",
      ": ping 1724500000000\n\n",
      'event: notification.badge\nid: 1724500000000-0\ndata: {"id":"1724500000000-0","type":"notification.badge","timestamp":"2026-09-04T10:00:00Z","payload":{"unreadCount":3}}\n\n',
    ]),
  );
  // ...
});
```

Что стоит покрыть тестами: кадр, разрезанный между чанками; кадр без `id`; битый JSON в `data`; `401` → refresh → повторное подключение; `429` → ожидание `Retry-After`; `auth.revoked` → отсутствие реконнекта.

Для Storybook и E2E проще поднять мок-эндпоинт, отдающий готовый набор кадров, — подход тот же, что описан в [realtime.md](./realtime.md), раздел 7.

---

## 11. Чек-лист и грабли

- [ ] Поток поднимается **один раз** в корневом провайдере, а не в каждом виджете.
- [ ] Есть `"use client"`, и никаких обращений к `sessionStorage`/`window` при SSR.
- [ ] В cleanup эффекта вызывается `abort()` — иначе StrictMode и навигация плодят соединения.
- [ ] `lastEventId` обновляется только при непустом `id`.
- [ ] Обработчики идемпотентны: доставка at-least-once.
- [ ] На `onOpen` инвалидируются ключевые запросы (Replay хранит только ~100 последних событий, TTL 7 дней).
- [ ] `auth.revoked` и неуспешный refresh ведут к логауту **без** реконнекта.
- [ ] Backoff экспоненциальный, с джиттером и потолком ~30 с.
- [ ] Watchdog рвёт «тихое» соединение: сервер обязан слать `: ping` раз в 15 с.
- [ ] Тяжёлая работа в обработчике вынесена из синхронного пути — иначе сервер отключит вас как slow consumer (буфер 128 событий, grace 30 с).
- [ ] Токен **никогда** не попадает в query string (сервер вернёт `400`).

Отдельно про инфраструктуру: если поток «висит» без единого события до самого обрыва, почти всегда виноват буферизующий прокси между браузером и `apps/realtime`. Сервис уже шлёт `X-Accel-Buffering: no` и `Cache-Control: no-transform`, но dev-прокси Next.js или корпоративный прокси могут это игнорировать — проверяйте, идут ли `: ping`, в DevTools → Network → вкладка ответа потока.
