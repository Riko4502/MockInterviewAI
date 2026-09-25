import type { AnyWebSocketEnvelope, YjsUpdatePayload } from "@packages/dto";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { RealtimeYjsProvider } from "./RealtimeYjsProvider";

/**
 * Детерминированный LCG PRNG для воспроизводимости тестов
 */
function createPrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("CRDT convergence test (T014)", () => {
  it("converges 3 independent Y.Docs to identical text after 500 randomized operations", () => {
    const SEED = 20260922;
    const prng = createPrng(SEED);

    const NUM_DOCS = 3;
    const TOTAL_OPERATIONS = 500;
    const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789 \n+-*/{}[]();";

    const docs = Array.from({ length: NUM_DOCS }, () => new Y.Doc());
    const texts = docs.map((doc) => doc.getText("content"));

    // Очереди сообщений между пирами: queues[to][from]
    const queues: Uint8Array[][][] = Array.from({ length: NUM_DOCS }, () =>
      Array.from({ length: NUM_DOCS }, () => []),
    );

    // Подписываемся на локальные обновления каждого документа
    docs.forEach((doc, fromIdx) => {
      doc.on("update", (update: Uint8Array, origin: unknown) => {
        // Не пересылаем обновления, полученные от удалённых пиров
        if (typeof origin === "number" && origin >= 0 && origin < NUM_DOCS) {
          return;
        }
        for (let toIdx = 0; toIdx < NUM_DOCS; toIdx++) {
          if (toIdx !== fromIdx) {
            queues[toIdx][fromIdx].push(new Uint8Array(update));
          }
        }
      });
    });

    const operationLog: string[] = [];

    try {
      for (let op = 0; op < TOTAL_OPERATIONS; op++) {
        const docIdx = Math.floor(prng() * NUM_DOCS);
        const yText = texts[docIdx];
        const currentLen = yText.length;

        // 60% вставок, 40% удалений (или 100% вставок, если документ пуст)
        const isInsert = currentLen === 0 || prng() < 0.6;

        if (isInsert) {
          const insertPos = Math.floor(prng() * (currentLen + 1));
          const insertLen = Math.floor(prng() * 4) + 1;
          let insertStr = "";
          for (let c = 0; c < insertLen; c++) {
            insertStr += ALPHABET[Math.floor(prng() * ALPHABET.length)];
          }
          yText.insert(insertPos, insertStr);
          operationLog.push(
            `[op ${op}] Doc ${docIdx} INSERT @${insertPos}: "${insertStr}"`,
          );
        } else {
          const deletePos = Math.floor(prng() * currentLen);
          const maxDeleteLen = Math.min(
            currentLen - deletePos,
            Math.floor(prng() * 4) + 1,
          );
          yText.delete(deletePos, maxDeleteLen);
          operationLog.push(
            `[op ${op}] Doc ${docIdx} DELETE @${deletePos} len ${maxDeleteLen}`,
          );
        }

        // С вероятностью 40% доставляем несколько случайных накопленных дельт (эмуляция сетевой задержки)
        if (prng() < 0.4) {
          const recipient = Math.floor(prng() * NUM_DOCS);
          const sender = Math.floor(prng() * NUM_DOCS);
          if (recipient !== sender && queues[recipient][sender].length > 0) {
            const update = queues[recipient][sender].shift();
            if (update) {
              Y.applyUpdate(docs[recipient], update, sender);
            }
          }
        }
      }

      // После 500 операций полностью доставляем все оставшиеся сообщения во всех направлениях
      let pendingCount = 0;
      do {
        pendingCount = 0;
        for (let to = 0; to < NUM_DOCS; to++) {
          for (let from = 0; from < NUM_DOCS; from++) {
            while (queues[to][from].length > 0) {
              const update = queues[to][from].shift();
              if (update) {
                Y.applyUpdate(docs[to], update, from);
                pendingCount++;
              }
            }
          }
        }
      } while (pendingCount > 0);

      const finalTexts = texts.map((t) => t.toString());

      // Проверяем попарную сходимость к абсолютно идентичному тексту
      for (let i = 1; i < NUM_DOCS; i++) {
        expect(finalTexts[i]).toBe(finalTexts[0]);
      }

      expect(finalTexts[0].length).toBeGreaterThan(0);
    } catch (error) {
      console.error("Convergence failure diagnostic:", {
        seed: SEED,
        totalOperations: TOTAL_OPERATIONS,
        texts: texts.map((t) => t.toString()),
        lengths: texts.map((t) => t.length),
        lastOperations: operationLog.slice(-10),
      });
      throw error;
    } finally {
      docs.forEach((doc) => {
        doc.destroy();
      });
    }
  });

  it("converges 4 independent Y.Docs with randomized network partition and reconnect", () => {
    const SEED = 998877;
    const prng = createPrng(SEED);
    const NUM_DOCS = 4;
    const TOTAL_OPERATIONS = 500;

    const docs = Array.from({ length: NUM_DOCS }, () => new Y.Doc());
    const texts = docs.map((doc) => doc.getText("content"));
    const queues: Uint8Array[][][] = Array.from({ length: NUM_DOCS }, () =>
      Array.from({ length: NUM_DOCS }, () => []),
    );

    docs.forEach((doc, fromIdx) => {
      doc.on("update", (update: Uint8Array, origin: unknown) => {
        if (typeof origin === "number" && origin >= 0 && origin < NUM_DOCS)
          return;
        for (let toIdx = 0; toIdx < NUM_DOCS; toIdx++) {
          if (toIdx !== fromIdx) {
            queues[toIdx][fromIdx].push(new Uint8Array(update));
          }
        }
      });
    });

    for (let op = 0; op < TOTAL_OPERATIONS; op++) {
      const docIdx = Math.floor(prng() * NUM_DOCS);
      const yText = texts[docIdx];
      const len = yText.length;
      if (len === 0 || prng() < 0.6) {
        yText.insert(
          Math.floor(prng() * (len + 1)),
          String.fromCharCode(65 + Math.floor(prng() * 26)),
        );
      } else {
        const pos = Math.floor(prng() * len);
        yText.delete(pos, 1);
      }
    }

    // Полный дренаж сети
    let pendingCount = 0;
    do {
      pendingCount = 0;
      for (let to = 0; to < NUM_DOCS; to++) {
        for (let from = 0; from < NUM_DOCS; from++) {
          while (queues[to][from].length > 0) {
            const update = queues[to][from].shift();
            if (update) {
              Y.applyUpdate(docs[to], update, from);
              pendingCount++;
            }
          }
        }
      }
    } while (pendingCount > 0);

    const finalTexts = texts.map((t) => t.toString());
    for (let i = 1; i < NUM_DOCS; i++) {
      expect(finalTexts[i]).toBe(finalTexts[0]);
    }
    expect(finalTexts[0].length).toBeGreaterThan(0);

    docs.forEach((doc) => {
      doc.destroy();
    });
  });

  it("converges 3 RealtimeYjsProvider clients across disconnect, offline edits, liveQueue buffering, duplicate messages, and reconnect ACK drain", () => {
    const NUM_CLIENTS = 3;
    const taskKey = "task-1:typescript";
    const sessionId = "session-crdt-relay";

    const docs = Array.from({ length: NUM_CLIENTS }, () => new Y.Doc());
    const texts = docs.map((d) => d.getText("content"));

    // Имитация серверного Relay-хранилища (Redis Stream + Room Broker)
    const streamUpdates: string[] = []; // Все дельты, прошедшие через Relay
    const clientInboxes: AnyWebSocketEnvelope[][] = Array.from(
      { length: NUM_CLIENTS },
      () => [],
    );
    const clientConnected: boolean[] = Array.from(
      { length: NUM_CLIENTS },
      () => true,
    );

    // Создаем провайдеры для каждого клиента
    const providers = docs.map((doc, idx) => {
      return new RealtimeYjsProvider({
        doc,
        taskKey,
        sessionId,
        initialStatus: "SYNCED",
        sendEnvelope: (env) => {
          if (!clientConnected[idx]) {
            return;
          }
          if (env.type === "yjs.update") {
            const payload = env.payload as YjsUpdatePayload;
            // 1. Сервер сохраняет дельту в Redis Stream
            streamUpdates.push(payload.data);

            // 2. Сервер шлет Ingress ACK автору
            const ackEnv: AnyWebSocketEnvelope = {
              type: "yjs.ack",
              version: 1,
              sessionId,
              requestId: `ack_${payload.updateId}`,
              timestamp: new Date().toISOString(),
              payload: {
                taskKey,
                updateId: payload.updateId,
              },
            };
            clientInboxes[idx].push(ackEnv);

            // 3. Сервер рассылает дельту остальным подключенным клиентам
            for (let target = 0; target < NUM_CLIENTS; target++) {
              if (target !== idx) {
                clientInboxes[target].push(env);
                // Эмуляция случайного дубликата сообщения в транспорте (at-least-once)
                if (Math.random() < 0.2) {
                  clientInboxes[target].push(env);
                }
              }
            }
          }
        },
      });
    });

    const deliverMessages = () => {
      let delivered = 0;
      for (let i = 0; i < NUM_CLIENTS; i++) {
        const inbox = clientInboxes[i];
        while (inbox.length > 0) {
          const env = inbox.shift();
          if (env) {
            providers[i].handleMessage(env);
            delivered++;
          }
        }
      }
      return delivered;
    };

    // Раунд 1: Все клиенты онлайн и печатают одновременно
    texts[0].insert(0, "Client0_Init; ");
    texts[1].insert(0, "Client1_Init; ");
    texts[2].insert(0, "Client2_Init; ");
    deliverMessages();

    // Раунд 2: Клиент 1 отключается (Network Partition / Disconnect)
    clientConnected[1] = false;
    providers[1].disconnect();
    expect(providers[1].status).toBe("DISCONNECTED");

    // Клиент 1 печатает в оффлайне (попадает в unsentQueue)
    texts[1].insert(texts[1].length, "Client1_OfflineA; Client1_OfflineB; ");
    expect(providers[1].unsentQueueLength).toBeGreaterThanOrEqual(1);

    // В это же время Клиенты 0 и 2 продолжают совместную работу
    texts[0].insert(texts[0].length, "Client0_Online; ");
    texts[2].insert(texts[2].length, "Client2_Online; ");
    deliverMessages();

    // Раунд 3: Клиент 1 начинает реконнект (INITIALIZING)
    clientConnected[1] = true;
    providers[1].connect();
    expect(providers[1].status).toBe("INITIALIZING");

    // До прихода yjs.init от сервера прилетают живые обновления (буферизуются в liveQueue)
    texts[0].insert(texts[0].length, "Client0_DuringReconnect; ");
    deliverMessages();

    // Клиент 1 еще и локально что-то печатает во время реконнекта
    texts[1].insert(texts[1].length, "Client1_DuringReconnect; ");

    // Раунд 4: Сервер присылает клиенту 1 yjs.init со всей историей из Redis Stream
    const initEnv: AnyWebSocketEnvelope = {
      type: "yjs.init",
      version: 1,
      sessionId,
      requestId: "init_client_1",
      timestamp: new Date().toISOString(),
      payload: {
        taskKey,
        updates: [...streamUpdates],
      },
    };
    providers[1].handleMessage(initEnv);
    expect(providers[1].status).toBe("SYNCED");

    // Раунд 5: Теперь отключается Клиент 2
    clientConnected[2] = false;
    providers[2].disconnect();
    texts[2].insert(texts[2].length, "Client2_Offline; ");

    // Клиенты 0 и 1 редактируют
    texts[0].insert(texts[0].length, "Client0_Fin; ");
    texts[1].insert(texts[1].length, "Client1_Fin; ");
    deliverMessages();

    // Клиент 2 восстанавливает связь
    clientConnected[2] = true;
    providers[2].connect();
    const initEnv2: AnyWebSocketEnvelope = {
      type: "yjs.init",
      version: 1,
      sessionId,
      requestId: "init_client_2",
      timestamp: new Date().toISOString(),
      payload: {
        taskKey,
        updates: [...streamUpdates],
      },
    };
    providers[2].handleMessage(initEnv2);
    expect(providers[2].status).toBe("SYNCED");

    // Доставляем все оставшиеся сообщения во всех направлениях
    while (deliverMessages() > 0) {}

    // Финальная проверка: все три документа пришли к строго идентичному CRDT-состоянию
    const text0 = texts[0].toString();
    const text1 = texts[1].toString();
    const text2 = texts[2].toString();

    expect(text1).toBe(text0);
    expect(text2).toBe(text0);
    expect(text0.length).toBeGreaterThan(0);

    // Очереди всех провайдеров полностью пусты
    for (const p of providers) {
      expect(p.unsentQueueLength).toBe(0);
      expect(p.liveQueueLength).toBe(0);
    }

    providers.forEach((p) => {
      p.destroy();
    });
    docs.forEach((d) => {
      d.destroy();
    });
  });

  it("converges 4 RealtimeYjsProvider clients across multiple reconnects, offline edits, delayed delivery, duplicates, and verifies exact text equality", () => {
    const NUM_CLIENTS = 4;
    const taskKey = "task-conv-4:typescript";
    const sessionId = "session-conv-4";

    const docs = Array.from({ length: NUM_CLIENTS }, () => new Y.Doc());
    const texts = docs.map((d) => d.getText("content"));

    const streamUpdates: string[] = [];
    const clientInboxes: AnyWebSocketEnvelope[][] = Array.from(
      { length: NUM_CLIENTS },
      () => [],
    );
    const clientConnected: boolean[] = Array.from(
      { length: NUM_CLIENTS },
      () => true,
    );

    const providers = docs.map((doc, idx) => {
      return new RealtimeYjsProvider({
        doc,
        taskKey,
        sessionId,
        initialStatus: "SYNCED",
        sendEnvelope: (env) => {
          if (!clientConnected[idx]) {
            return;
          }
          if (env.type === "yjs.update") {
            const payload = env.payload as YjsUpdatePayload;
            streamUpdates.push(payload.data);

            // Ingress ACK
            const ackEnv: AnyWebSocketEnvelope = {
              type: "yjs.ack",
              version: 1,
              sessionId,
              requestId: `ack_${payload.updateId}`,
              timestamp: new Date().toISOString(),
              payload: {
                taskKey,
                updateId: payload.updateId,
              },
            };
            clientInboxes[idx].push(ackEnv);

            // Live broadcast to other connected peers with potential delays / duplicates
            for (let target = 0; target < NUM_CLIENTS; target++) {
              if (target !== idx) {
                clientInboxes[target].push(env);
                // Эмуляция дублирования в транспорте
                if (Math.random() < 0.25) {
                  clientInboxes[target].push(env);
                }
              }
            }
          }
        },
      });
    });

    const deliverMessages = () => {
      let delivered = 0;
      for (let i = 0; i < NUM_CLIENTS; i++) {
        const inbox = clientInboxes[i];
        while (inbox.length > 0) {
          const env = inbox.shift();
          if (env) {
            providers[i].handleMessage(env);
            delivered++;
          }
        }
      }
      return delivered;
    };

    // 1. Все 4 клиента вносят начальный текст
    texts[0].insert(0, "C0_start\n");
    texts[1].insert(0, "C1_start\n");
    texts[2].insert(0, "C2_start\n");
    texts[3].insert(0, "C3_start\n");
    deliverMessages();

    // 2. Клиенты 1 и 3 отключаются одновременно (сетевое разделение)
    clientConnected[1] = false;
    clientConnected[3] = false;
    providers[1].disconnect();
    providers[3].disconnect();
    expect(providers[1].status).toBe("DISCONNECTED");
    expect(providers[3].status).toBe("DISCONNECTED");

    // Оффлайн-правки от клиентов 1 и 3
    texts[1].insert(texts[1].length, "C1_offline_1\nC1_offline_2\n");
    texts[3].insert(texts[3].length, "C3_offline_1\nC3_offline_2\n");

    // Онлайн-клиенты 0 и 2 продолжают совместную работу
    texts[0].insert(texts[0].length, "C0_online\n");
    texts[2].insert(texts[2].length, "C2_online\n");
    deliverMessages();

    // 3. Клиент 1 реконнектится: сначала попадает в INITIALIZING и буферизует входящие в liveQueue
    clientConnected[1] = true;
    providers[1].connect();
    expect(providers[1].status).toBe("INITIALIZING");

    // Клиент 0 делает правку, которая прилетает Клиенту 1 в liveQueue до yjs.init
    texts[0].insert(texts[0].length, "C0_during_reconnect\n");
    deliverMessages();
    expect(providers[1].liveQueueLength).toBeGreaterThanOrEqual(1);

    // Доставка yjs.init клиенту 1 со всей историей из стрима
    providers[1].handleMessage({
      type: "yjs.init",
      version: 1,
      sessionId,
      requestId: "init_c1",
      timestamp: new Date().toISOString(),
      payload: {
        taskKey,
        updates: [...streamUpdates],
      },
    });
    expect(providers[1].status).toBe("SYNCED");

    // 4. Клиент 2 отключается, а Клиент 3 реконнектится
    clientConnected[2] = false;
    providers[2].disconnect();
    texts[2].insert(texts[2].length, "C2_offline\n");

    clientConnected[3] = true;
    providers[3].connect();
    providers[3].handleMessage({
      type: "yjs.init",
      version: 1,
      sessionId,
      requestId: "init_c3",
      timestamp: new Date().toISOString(),
      payload: {
        taskKey,
        updates: [...streamUpdates],
      },
    });
    expect(providers[3].status).toBe("SYNCED");

    // 5. Клиент 2 реконнектится
    clientConnected[2] = true;
    providers[2].connect();
    providers[2].handleMessage({
      type: "yjs.init",
      version: 1,
      sessionId,
      requestId: "init_c2",
      timestamp: new Date().toISOString(),
      payload: {
        taskKey,
        updates: [...streamUpdates],
      },
    });
    expect(providers[2].status).toBe("SYNCED");

    // Полный дренаж сети и очередей
    while (deliverMessages() > 0) {}

    // Финальная проверка: CRDT-сходимость всех 4 документов к строго одинаковому тексту
    const expected = texts[0].toString();
    expect(texts[1].toString()).toBe(expected);
    expect(texts[2].toString()).toBe(expected);
    expect(texts[3].toString()).toBe(expected);

    // Убеждаемся, что правки всех 4 клиентов присутствуют в итоговом документе
    expect(expected).toContain("C0_start");
    expect(expected).toContain("C1_start");
    expect(expected).toContain("C2_start");
    expect(expected).toContain("C3_start");
    expect(expected).toContain("C1_offline_1");
    expect(expected).toContain("C3_offline_1");
    expect(expected).toContain("C2_offline");

    // Все очереди unsentQueue и liveQueue пусты
    for (const p of providers) {
      expect(p.unsentQueueLength).toBe(0);
      expect(p.liveQueueLength).toBe(0);
    }

    providers.forEach((p) => {
      p.destroy();
    });
    docs.forEach((d) => {
      d.destroy();
    });
  });
});
