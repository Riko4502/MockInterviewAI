import type { AnyWebSocketEnvelope, YjsUpdatePayload } from "@packages/dto";
import { describe, expect, it, vi } from "vitest";
import { encodeAwarenessUpdate } from "y-protocols/awareness";
import * as Y from "yjs";
import {
  base64ToUint8Array,
  RealtimeYjsProvider,
  uint8ArrayToBase64,
} from "./RealtimeYjsProvider";

describe("RealtimeYjsProvider (T017)", () => {
  it("converts Uint8Array to Base64 and back losslessly", () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 42, 64]);
    const base64 = uint8ArrayToBase64(original);
    const restored = base64ToUint8Array(base64);
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  it("sends yjs.update with monotonic updateId on local doc edits", () => {
    const doc = new Y.Doc();
    const sentEnvelopes: AnyWebSocketEnvelope[] = [];

    const provider = new RealtimeYjsProvider({
      doc,
      taskKey: "task-1:typescript",
      sessionId: "session-123",
      sendEnvelope: (env) => sentEnvelopes.push(env),
    });

    const text = doc.getText("content");
    text.insert(0, "first");
    text.insert(5, " second");

    expect(sentEnvelopes.length).toBe(2);

    const firstEnv = sentEnvelopes[0];
    const secondEnv = sentEnvelopes[1];

    expect(firstEnv.type).toBe("yjs.update");
    expect(firstEnv.sessionId).toBe("session-123");
    const firstPayload = firstEnv.payload as YjsUpdatePayload;
    const secondPayload = secondEnv.payload as YjsUpdatePayload;

    expect(firstPayload.taskKey).toBe("task-1:typescript");
    expect(firstPayload.updateId).toBeDefined();

    expect(secondEnv.type).toBe("yjs.update");
    expect(secondPayload.taskKey).toBe("task-1:typescript");

    // Проверяем монотонность updateId
    const id1 = firstPayload.updateId;
    const id2 = secondPayload.updateId;
    const seq1 = parseInt(id1.split(":")[1], 10);
    const seq2 = parseInt(id2.split(":")[1], 10);
    expect(seq2).toBeGreaterThan(seq1);

    provider.destroy();
    doc.destroy();
  });

  it("applies incoming yjs.update and avoids cyclic retransmission", () => {
    const localDoc = new Y.Doc();
    const sentEnvelopes: AnyWebSocketEnvelope[] = [];

    const provider = new RealtimeYjsProvider({
      doc: localDoc,
      taskKey: "task-1:typescript",
      sessionId: "session-123",
      sendEnvelope: (env) => sentEnvelopes.push(env),
    });

    // Создаем удаленное обновление
    const remoteDoc = new Y.Doc();
    const remoteText = remoteDoc.getText("content");
    remoteText.insert(0, "remote text");
    const update = Y.encodeStateAsUpdate(remoteDoc);

    // Доставляем incoming yjs.update
    provider.handleMessage({
      type: "yjs.update",
      version: 1,
      sessionId: "session-123",
      requestId: "req_remote",
      timestamp: new Date().toISOString(),
      payload: {
        taskKey: "task-1:typescript",
        updateId: "remote_1",
        data: uint8ArrayToBase64(update),
      },
    } as AnyWebSocketEnvelope);

    // Текст применился в локальный документ
    expect(localDoc.getText("content").toString()).toBe("remote text");

    // Провайдер НЕ отправил ответное сообщение (нет петли ретрансляции)
    expect(sentEnvelopes.length).toBe(0);

    provider.destroy();
    localDoc.destroy();
    remoteDoc.destroy();
  });

  it("applies incoming yjs.init with multiple initial updates", () => {
    const doc = new Y.Doc();
    const provider = new RealtimeYjsProvider({
      doc,
      taskKey: "task-1:typescript",
      sessionId: "session-123",
      sendEnvelope: () => {},
    });

    const sourceDoc = new Y.Doc();
    const sourceText = sourceDoc.getText("content");
    sourceText.insert(0, "hello");
    const update1 = Y.encodeStateAsUpdate(sourceDoc);
    const sv1 = Y.encodeStateVector(sourceDoc);

    sourceText.insert(5, " world");
    const update2 = Y.encodeStateAsUpdate(sourceDoc, sv1);

    provider.handleMessage({
      type: "yjs.init",
      version: 1,
      sessionId: "session-123",
      requestId: "req_init",
      timestamp: new Date().toISOString(),
      payload: {
        taskKey: "task-1:typescript",
        updates: [uint8ArrayToBase64(update1), uint8ArrayToBase64(update2)],
      },
    } as AnyWebSocketEnvelope);

    expect(doc.getText("content").toString()).toBe("hello world");

    provider.destroy();
    doc.destroy();
    sourceDoc.destroy();
  });

  it("cleans up doc and socket listeners upon destroy", () => {
    const doc = new Y.Doc();
    let sentCount = 0;

    const provider = new RealtimeYjsProvider({
      doc,
      taskKey: "task-1:typescript",
      sessionId: "session-123",
      sendEnvelope: () => {
        sentCount++;
      },
    });

    doc.getText("content").insert(0, "before destroy");
    expect(sentCount).toBe(1);

    provider.destroy();

    doc.getText("content").insert(14, " after destroy");
    // Больше не отправляет сообщения
    expect(sentCount).toBe(1);

    doc.destroy();
  });

  describe("Awareness & Multiplayer Cursors (T019, T022, T023)", () => {
    it("broadcasts awareness updates and applies them to remote peer without echo loop (T019)", () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const sentEnvelopes1: AnyWebSocketEnvelope[] = [];
      const sentEnvelopes2: AnyWebSocketEnvelope[] = [];

      const provider1 = new RealtimeYjsProvider({
        doc: doc1,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        sendEnvelope: (env) => sentEnvelopes1.push(env),
      });

      const provider2 = new RealtimeYjsProvider({
        doc: doc2,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        sendEnvelope: (env) => sentEnvelopes2.push(env),
      });

      // 1. Client 1 обновляет свое состояние присутствия (user + cursor)
      provider1.awareness.setLocalStateField("user", {
        userId: "user-alice",
        name: "Alice",
        color: "#10b981",
      });

      expect(sentEnvelopes1.length).toBe(1);
      const awEnv = sentEnvelopes1[0];
      expect(awEnv.type).toBe("yjs.awareness");
      expect(awEnv.sessionId).toBe("session-123");

      // 2. Client 2 получает этот конверт через сокет
      provider2.handleMessage(awEnv);

      // Проверяем, что в awareness второго провайдера появилось состояние Alice
      const aliceState = provider2.awareness.getStates().get(doc1.clientID);
      expect(aliceState).toBeDefined();
      expect(aliceState?.user).toEqual({
        userId: "user-alice",
        name: "Alice",
        color: "#10b981",
      });

      // 3. Client 2 НЕ отправил ответное сообщение (нет эхо-петли)
      expect(sentEnvelopes2.length).toBe(0);

      provider1.destroy();
      provider2.destroy();
      doc1.destroy();
      doc2.destroy();
    });

    it("preserves relative cursor position when inserting 5 lines above cursor (T019, T023)", () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const text1 = doc1.getText("content");
      const text2 = doc2.getText("content");

      // Начальное содержимое документа: 4 строки
      const initialText = "line 1\nline 2\nline 3\nline 4\n";
      text1.insert(0, initialText);

      // Синхронизируем начальное состояние на doc2
      const initUpdate = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, initUpdate);
      expect(text2.toString()).toBe(initialText);

      const provider1 = new RealtimeYjsProvider({
        doc: doc1,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
      });

      const provider2 = new RealtimeYjsProvider({
        doc: doc2,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
      });

      // Курсор Alice стоит на 15-м символе (внутри "line 3")
      const originalCursorOffset = 15;
      const relPos = Y.createRelativePositionFromTypeIndex(
        text1,
        originalCursorOffset,
      );
      provider1.awareness.setLocalStateField("selection", {
        anchor: relPos,
        head: relPos,
      });

      // Передаем awareness в provider2
      const awUpdate = encodeAwarenessUpdate(provider1.awareness, [
        doc1.clientID,
      ]);
      provider2.handleMessage({
        type: "yjs.awareness",
        version: 1,
        sessionId: "session-123",
        requestId: "req_aw_pos",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          data: uint8ArrayToBase64(awUpdate),
        },
      } as AnyWebSocketEnvelope);

      // Вставляем ровно 5 новых строк В НАЧАЛО файла (выше курсора)
      const insertedPrefix =
        "header line 1\nheader line 2\nheader line 3\nheader line 4\nheader line 5\n";
      const insertedLength = insertedPrefix.length;
      text2.insert(0, insertedPrefix);

      // Синхронизируем текстовое обновление на doc1
      const textUpdate = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc1, textUpdate);

      // Извлекаем сохраненную относительную позицию курсора Alice из состояния provider2
      const aliceState = provider2.awareness.getStates().get(doc1.clientID);
      expect(aliceState?.selection?.anchor).toBeDefined();

      // Вычисляем абсолютную позицию каретки после смещения текста
      const absoluteAnchor = Y.createAbsolutePositionFromRelativePosition(
        aliceState?.selection.anchor,
        doc2,
      );

      expect(absoluteAnchor).not.toBeNull();
      // Позиция сместилась ровно на длину вставленных 5 строк
      expect(absoluteAnchor?.index).toBe(originalCursorOffset + insertedLength);

      provider1.destroy();
      provider2.destroy();
      doc1.destroy();
      doc2.destroy();
    });

    it("removes remote collaborator awareness on presence.leave (T022, T023)", () => {
      const doc = new Y.Doc();
      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        sendEnvelope: () => {},
      });

      // Эмулируем входящее состояние соавтора Bob (clientID: 9999)
      const remoteDoc = new Y.Doc();
      remoteDoc.clientID = 9999;
      const remoteProvider = new RealtimeYjsProvider({
        doc: remoteDoc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        user: {
          userId: "user-bob-42",
          name: "Bob",
          color: "#3b82f6",
        },
      });

      const remoteAwUpdate = encodeAwarenessUpdate(remoteProvider.awareness, [
        remoteDoc.clientID,
      ]);

      provider.handleMessage({
        type: "yjs.awareness",
        version: 1,
        sessionId: "session-123",
        requestId: "req_aw_bob",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          data: uint8ArrayToBase64(remoteAwUpdate),
        },
      } as AnyWebSocketEnvelope);

      // Проверяем, что Bob присутствует в состояниях
      expect(provider.awareness.getStates().get(9999)).toBeDefined();

      // Приходит служебное событие presence.leave от сервера (Bob отключился)
      provider.handleMessage({
        type: "presence.leave",
        version: 1,
        sessionId: "session-123",
        requestId: "req_leave_bob",
        timestamp: new Date().toISOString(),
        payload: {
          userId: "user-bob-42",
          username: "Bob",
          role: "interviewer",
          userCount: 1,
        },
      } as AnyWebSocketEnvelope);

      // Состояние Bob должно быть полностью удалено из awareness
      expect(provider.awareness.getStates().get(9999)).toBeUndefined();

      provider.destroy();
      remoteProvider.destroy();
      doc.destroy();
      remoteDoc.destroy();
    });

    it("cleans up local presence state on provider.destroy (T022)", () => {
      const doc = new Y.Doc();
      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        user: {
          userId: "user-self",
          name: "Self",
        },
      });

      expect(provider.awareness.getLocalState()?.user).toBeDefined();

      provider.destroy();

      // Локальное состояние удалено
      expect(provider.awareness.getStates().get(doc.clientID)).toBeUndefined();

      doc.destroy();
    });

    it("prunes outdated awareness states after 30 seconds inactivity timeout (T022, T023)", () => {
      vi.useFakeTimers();

      const doc = new Y.Doc();
      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
      });

      // Добавляем удаленного клиента напрямую в awareness с временной меткой сейчас
      const remoteClientId = 8888;
      const remoteDoc = new Y.Doc();
      remoteDoc.clientID = remoteClientId;
      const remoteProvider = new RealtimeYjsProvider({
        doc: remoteDoc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        user: {
          userId: "ghost-user",
          name: "Ghost",
        },
      });

      const awBytes = encodeAwarenessUpdate(remoteProvider.awareness, [
        remoteClientId,
      ]);
      provider.handleMessage({
        type: "yjs.awareness",
        version: 1,
        sessionId: "session-123",
        requestId: "req_aw_ghost",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          data: uint8ArrayToBase64(awBytes),
        },
      } as AnyWebSocketEnvelope);

      expect(provider.awareness.getStates().get(remoteClientId)).toBeDefined();

      // Симулируем устаревание метаданных удаленного клиента (> 30000ms неактивности)
      const meta = provider.awareness.meta.get(remoteClientId);
      if (meta) {
        meta.lastUpdated = Date.now() - 35000;
      }

      // Продвигаем таймеры, чтобы сработал периодический интервал проверки awareness (_checkInterval = 3000ms)
      vi.advanceTimersByTime(5000);

      // Встроенный periodic check протокола Awareness удаляет неактивного участника по таймауту 30 секунд
      expect(
        provider.awareness.getStates().get(remoteClientId),
      ).toBeUndefined();

      provider.destroy();
      remoteProvider.destroy();
      doc.destroy();
      remoteDoc.destroy();

      vi.useRealTimers();
    });

    it("broadcasts local awareness when receiving presence.join from a new peer (T019)", () => {
      const doc = new Y.Doc();
      const sentEnvelopes: AnyWebSocketEnvelope[] = [];

      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        user: {
          userId: "user-host",
          name: "Host",
        },
        sendEnvelope: (env) => sentEnvelopes.push(env),
      });

      expect(sentEnvelopes.length).toBe(1); // Первоначальный анонс при создании user
      sentEnvelopes.length = 0;

      // Приходит событие presence.join (новый участник зашел в комнату)
      provider.handleMessage({
        type: "presence.join",
        version: 1,
        sessionId: "session-123",
        requestId: "req_join_new",
        timestamp: new Date().toISOString(),
        payload: {
          userId: "user-new",
          username: "New Participant",
          role: "candidate",
          userCount: 2,
        },
      } as AnyWebSocketEnvelope);

      // Провайдер должен отправить свое актуальное состояние присутствия
      expect(sentEnvelopes.length).toBe(1);
      expect(sentEnvelopes[0].type).toBe("yjs.awareness");

      provider.destroy();
      doc.destroy();
    });
  });

  describe("Phase 5: Reconnect & Reliability (T024–T027)", () => {
    it("T024: holds deltas in unsentQueue until receiving Ingress ACK (yjs.ack)", () => {
      const doc = new Y.Doc();
      const sentEnvelopes: AnyWebSocketEnvelope[] = [];

      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        initialStatus: "SYNCED",
        sendEnvelope: (env) => sentEnvelopes.push(env),
      });

      expect(provider.unsentQueueLength).toBe(0);

      // 1. Локальная правка
      doc.getText("content").insert(0, "delta-1");
      expect(sentEnvelopes.length).toBe(1);
      expect(provider.unsentQueueLength).toBe(1);

      const firstSent = sentEnvelopes[0];
      const updateId1 = (firstSent.payload as YjsUpdatePayload).updateId;
      expect(provider.getUnsentQueue()[0]?.updateId).toBe(updateId1);

      // 2. Вторая локальная правка
      doc.getText("content").insert(7, " delta-2");
      expect(sentEnvelopes.length).toBe(2);
      expect(provider.unsentQueueLength).toBe(2);

      const updateId2 = (sentEnvelopes[1].payload as YjsUpdatePayload).updateId;

      // 3. Отправка сама по себе НЕ удаляет элементы из unsentQueue!
      expect(provider.unsentQueueLength).toBe(2);

      // 4. Приходит yjs.ack для первого updateId
      provider.handleMessage({
        type: "yjs.ack",
        version: 1,
        sessionId: "session-123",
        requestId: "ack-1",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updateId: updateId1,
        },
      });

      // Первый удален, второй остался
      expect(provider.unsentQueueLength).toBe(1);
      expect(provider.getUnsentQueue()[0]?.updateId).toBe(updateId2);

      // 5. Приходит yjs.ack для второго updateId
      provider.handleMessage({
        type: "yjs.ack",
        version: 1,
        sessionId: "session-123",
        requestId: "ack-2",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updateId: updateId2,
        },
      });

      expect(provider.unsentQueueLength).toBe(0);

      provider.destroy();
      doc.destroy();
    });

    it("Scenario A (T024, T025): queues edits during disconnect and drains them upon reconnect without loss", () => {
      const doc = new Y.Doc();
      const sentEnvelopes: AnyWebSocketEnvelope[] = [];

      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        initialStatus: "SYNCED",
        sendEnvelope: (env) => sentEnvelopes.push(env),
      });

      // 1. Связь разорвана
      provider.disconnect();
      expect(provider.status).toBe("DISCONNECTED");
      sentEnvelopes.length = 0;

      // 2. Пользователь вносит три правки во время обрыва связи: A, B, C
      const text = doc.getText("content");
      text.insert(0, "A");
      text.insert(1, "B");
      text.insert(2, "C");

      // Во время disconnect сообщения в сокет НЕ уходят!
      expect(sentEnvelopes.length).toBe(0);
      // Но все сохранены в unsentQueue
      expect(provider.unsentQueueLength).toBe(3);

      // 3. Восстановление соединения -> получение yjs.init
      provider.connect();
      expect(provider.status).toBe("INITIALIZING");

      provider.handleMessage({
        type: "yjs.init",
        version: 1,
        sessionId: "session-123",
        requestId: "req_init",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updates: [],
        },
      });

      // Провайдер перешел в SYNCED
      expect(provider.status).toBe("SYNCED");

      // Все три обновления объединены через Y.mergeUpdates и отправлены единым батчем
      expect(sentEnvelopes.length).toBe(1);
      const batchEnv = sentEnvelopes[0];
      expect(batchEnv.type).toBe("yjs.update");
      const batchPayload = batchEnv.payload as YjsUpdatePayload;
      expect(batchPayload.updateId).toContain(":batch_");

      // До подтверждения ACK очередь unsentQueue все еще содержит элементы!
      expect(provider.unsentQueueLength).toBe(3);

      // 4. Сервер подтверждает получение батча через yjs.ack
      provider.handleMessage({
        type: "yjs.ack",
        version: 1,
        sessionId: "session-123",
        requestId: "ack_batch",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updateId: batchPayload.updateId,
        },
      });

      // Очередь полностью очищена!
      expect(provider.unsentQueueLength).toBe(0);
      expect(text.toString()).toBe("ABC");

      provider.destroy();
      doc.destroy();
    });

    it("Scenario B (T025, T026): buffers remote updates during reconnect in liveQueue and applies them without echo loop", () => {
      const localDoc = new Y.Doc();
      const sentEnvelopes: AnyWebSocketEnvelope[] = [];

      const provider = new RealtimeYjsProvider({
        doc: localDoc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        initialStatus: "DISCONNECTED",
        sendEnvelope: (env) => sentEnvelopes.push(env),
      });

      // 1. Локальная правка в оффлайне
      localDoc.getText("content").insert(0, "local_edit");
      expect(provider.unsentQueueLength).toBe(1);
      expect(sentEnvelopes.length).toBe(0);

      // 2. Начинается реконнект (INITIALIZING)
      provider.connect();
      expect(provider.status).toBe("INITIALIZING");

      // 3. Во время INITIALIZING до yjs.init приходит remote update от соавтора
      const remoteDoc = new Y.Doc();
      remoteDoc.getText("content").insert(0, "remote_prefix_");
      const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);

      provider.handleMessage({
        type: "yjs.update",
        version: 1,
        sessionId: "session-123",
        requestId: "req_remote_1",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updateId: "remote_up_1",
          data: uint8ArrayToBase64(remoteUpdate),
        },
      });

      // Должно попасть в liveQueue, а не применяться прямо сейчас!
      expect(provider.liveQueueLength).toBe(1);
      expect(localDoc.getText("content").toString()).toBe("local_edit");

      // 4. Еще одна локальная правка во время ожидания yjs.init
      localDoc.getText("content").insert(10, "_local_suffix");
      expect(provider.unsentQueueLength).toBe(2);

      // 5. Приходит yjs.init
      provider.handleMessage({
        type: "yjs.init",
        version: 1,
        sessionId: "session-123",
        requestId: "req_init_b",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updates: [],
        },
      });

      // Статус перешел в SYNCED
      expect(provider.status).toBe("SYNCED");
      // liveQueue синхронно опустошена
      expect(provider.liveQueueLength).toBe(0);

      // Удаленное обновление применилось бесконфликтно к локальному документу
      const finalText = localDoc.getText("content").toString();
      expect(finalText).toContain("remote_prefix_");
      expect(finalText).toContain("local_edit");
      expect(finalText).toContain("_local_suffix");

      // В сокет отправлены ТОЛЬКО локальные правки (объединенные), НЕТ эхо-петли remote-обновления!
      expect(sentEnvelopes.length).toBe(1);
      const sentPayload = sentEnvelopes[0].payload as YjsUpdatePayload;
      expect(sentPayload.updateId).toContain(":batch_");

      provider.destroy();
      localDoc.destroy();
      remoteDoc.destroy();
    });

    it("Scenario C (T027): handles lost ACK across disconnect and reconnect without losing deltas", () => {
      const doc = new Y.Doc();
      const sentEnvelopes: AnyWebSocketEnvelope[] = [];

      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        initialStatus: "SYNCED",
        sendEnvelope: (env) => sentEnvelopes.push(env),
      });

      // 1. Клиент отправил обновление
      doc.getText("content").insert(0, "important-code");
      expect(sentEnvelopes.length).toBe(1);
      const firstUpdateId = (sentEnvelopes[0].payload as YjsUpdatePayload)
        .updateId;

      // Дельта в unsentQueue
      expect(provider.unsentQueueLength).toBe(1);

      // 2. Сервер принял, но до отправки ACK произошел обрыв соединения (ACK lost)
      provider.disconnect();
      expect(provider.status).toBe("DISCONNECTED");
      sentEnvelopes.length = 0;

      // Дельта НЕ удалена, потому что ACK не был получен!
      expect(provider.unsentQueueLength).toBe(1);

      // 3. Реконнект
      provider.connect();
      provider.handleMessage({
        type: "yjs.init",
        version: 1,
        sessionId: "session-123",
        requestId: "init_rec",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updates: [],
        },
      });

      expect(provider.status).toBe("SYNCED");

      // Неподтвержденная дельта повторно отправлена!
      expect(sentEnvelopes.length).toBe(1);
      const resentPayload = sentEnvelopes[0].payload as YjsUpdatePayload;
      expect(resentPayload.updateId).toBe(firstUpdateId);

      // 4. Теперь сервер присылает ACK
      provider.handleMessage({
        type: "yjs.ack",
        version: 1,
        sessionId: "session-123",
        requestId: "ack_resent",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updateId: firstUpdateId,
        },
      });

      // Только теперь удаляется из unsentQueue!
      expect(provider.unsentQueueLength).toBe(0);

      provider.destroy();
      doc.destroy();
    });

    it("Scenario D (T025, T027): handles concurrent local typing during batch ACK wait", () => {
      const doc = new Y.Doc();
      const sentEnvelopes: AnyWebSocketEnvelope[] = [];

      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        initialStatus: "DISCONNECTED",
        sendEnvelope: (env) => sentEnvelopes.push(env),
      });

      // 1. Оффлайн-правки 1 и 2
      const text = doc.getText("content");
      text.insert(0, "line1\n");
      text.insert(6, "line2\n");
      expect(provider.unsentQueueLength).toBe(2);

      // 2. Реконнект -> получение yjs.init
      provider.connect();
      provider.handleMessage({
        type: "yjs.init",
        version: 1,
        sessionId: "session-123",
        requestId: "init_d",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updates: [],
        },
      });

      // Батч отправлен
      expect(sentEnvelopes.length).toBe(1);
      const batchUpdateId = (sentEnvelopes[0].payload as YjsUpdatePayload)
        .updateId;

      // 3. ДО получения ACK на батч пользователь печатает новую правку 3
      text.insert(12, "line3\n");

      // Новая правка отправлена со своим собственным updateId, добавленным в хвост unsentQueue
      expect(sentEnvelopes.length).toBe(2);
      const singleUpdateId = (sentEnvelopes[1].payload as YjsUpdatePayload)
        .updateId;
      expect(provider.unsentQueueLength).toBe(3);

      // 4. Приходит ACK на первый батч
      provider.handleMessage({
        type: "yjs.ack",
        version: 1,
        sessionId: "session-123",
        requestId: "ack_d1",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updateId: batchUpdateId,
        },
      });

      // Правки из батча удалены, а правка 3 из хвоста сохранена!
      expect(provider.unsentQueueLength).toBe(1);
      expect(provider.getUnsentQueue()[0]?.updateId).toBe(singleUpdateId);

      // 5. Приходит ACK на правку 3
      provider.handleMessage({
        type: "yjs.ack",
        version: 1,
        sessionId: "session-123",
        requestId: "ack_d2",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updateId: singleUpdateId,
        },
      });

      expect(provider.unsentQueueLength).toBe(0);
      expect(text.toString()).toBe("line1\nline2\nline3\n");

      provider.destroy();
      doc.destroy();
    });

    it("Scenario E (T027): repeated disconnect/reconnect cycles cause no listener leaks or echo loops", () => {
      const doc = new Y.Doc();
      const sentEnvelopes: AnyWebSocketEnvelope[] = [];

      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        initialStatus: "SYNCED",
        sendEnvelope: (env) => sentEnvelopes.push(env),
      });

      // Выполняем 5 последовательных циклов disconnect / reconnect
      for (let i = 0; i < 5; i++) {
        provider.disconnect();
        expect(provider.status).toBe("DISCONNECTED");

        doc.getText("content").insert(i, `${i}`);

        provider.connect();
        expect(provider.status).toBe("INITIALIZING");

        provider.handleMessage({
          type: "yjs.init",
          version: 1,
          sessionId: "session-123",
          requestId: `init_rep_${i}`,
          timestamp: new Date().toISOString(),
          payload: {
            taskKey: "task-1:typescript",
            updates: [],
          },
        });

        expect(provider.status).toBe("SYNCED");

        // Подтверждаем отправленные дельты
        const lastSent = sentEnvelopes[sentEnvelopes.length - 1];
        if (lastSent && lastSent.type === "yjs.update") {
          const payload = lastSent.payload as YjsUpdatePayload;
          provider.handleMessage({
            type: "yjs.ack",
            version: 1,
            sessionId: "session-123",
            requestId: `ack_rep_${i}`,
            timestamp: new Date().toISOString(),
            payload: {
              taskKey: "task-1:typescript",
              updateId: payload.updateId,
            },
          });
        }
      }

      // Все дельты подтверждены, нет утечек
      expect(provider.unsentQueueLength).toBe(0);
      expect(provider.liveQueueLength).toBe(0);

      // Проверяем, что listener Y.Doc не продублировался (одна правка порождает ровно одно сообщение)
      const countBefore = sentEnvelopes.length;
      doc.getText("content").insert(0, "X");
      expect(sentEnvelopes.length).toBe(countBefore + 1);

      provider.destroy();
      doc.destroy();
    });

    it("Scenario F (T027): provider.destroy() completely frees queues and subscriptions", () => {
      const doc = new Y.Doc();
      let sentCount = 0;

      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        initialStatus: "DISCONNECTED",
        sendEnvelope: () => sentCount++,
      });

      // Наполняем unsentQueue
      doc.getText("content").insert(0, "unsent-text");
      expect(provider.unsentQueueLength).toBe(1);

      // Наполняем liveQueue
      provider.connect();
      provider.handleMessage({
        type: "yjs.update",
        version: 1,
        sessionId: "session-123",
        requestId: "req_live",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updateId: "rem_1",
          data: uint8ArrayToBase64(new Uint8Array([0, 0])),
        },
      });
      expect(provider.liveQueueLength).toBe(1);

      // Уничтожаем провайдер
      provider.destroy();

      // Очереди очищены
      expect(provider.unsentQueueLength).toBe(0);
      expect(provider.liveQueueLength).toBe(0);
      expect(provider.status).toBe("DISCONNECTED");

      // Последующие правки в Y.Doc не обрабатываются
      doc.getText("content").insert(0, "after-destroy");
      expect(sentCount).toBe(0);

      // Сообщения из сети не обрабатываются
      provider.handleMessage({
        type: "yjs.init",
        version: 1,
        sessionId: "session-123",
        requestId: "late_init",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updates: [],
        },
      });
      expect(provider.status).toBe("DISCONNECTED");

      doc.destroy();
    });

    it("T026: overflows liveQueue beyond MAX_LIVE_QUEUE_SIZE (1000) and transitions to ERROR", () => {
      const doc = new Y.Doc();
      let capturedError: Error | null = null;

      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        initialStatus: "INITIALIZING",
        onError: (err) => {
          capturedError = err;
        },
      });

      const dummyUpdate = uint8ArrayToBase64(new Uint8Array([1, 2, 3]));

      // Заполняем liveQueue до 1000
      for (let i = 0; i < 1000; i++) {
        provider.handleMessage({
          type: "yjs.update",
          version: 1,
          sessionId: "session-123",
          requestId: `req_${i}`,
          timestamp: new Date().toISOString(),
          payload: {
            taskKey: "task-1:typescript",
            updateId: `up_${i}`,
            data: dummyUpdate,
          },
        });
      }

      expect(provider.liveQueueLength).toBe(1000);
      expect(provider.status).toBe("INITIALIZING");

      // 1001-е сообщение вызывает переполнение
      provider.handleMessage({
        type: "yjs.update",
        version: 1,
        sessionId: "session-123",
        requestId: "req_1001",
        timestamp: new Date().toISOString(),
        payload: {
          taskKey: "task-1:typescript",
          updateId: "up_1001",
          data: dummyUpdate,
        },
      });

      expect(provider.status).toBe("ERROR");
      expect(provider.liveQueueLength).toBe(0);
      expect(capturedError).not.toBeNull();
      expect((capturedError as unknown as Error)?.message).toContain(
        "live queue overflow",
      );

      provider.destroy();
      doc.destroy();
    });

    it("T026: transitions to ERROR when receiving room.error with SYNC_FAILED", () => {
      const doc = new Y.Doc();
      let capturedError: Error | null = null;

      const provider = new RealtimeYjsProvider({
        doc,
        taskKey: "task-1:typescript",
        sessionId: "session-123",
        initialStatus: "INITIALIZING",
        onError: (err) => {
          capturedError = err;
        },
      });

      provider.handleMessage({
        type: "room.error",
        version: 1,
        sessionId: "session-123",
        requestId: "err_sync",
        timestamp: new Date().toISOString(),
        payload: {
          code: "SYNC_FAILED",
          message: "Redis stream read failed",
          taskKey: "task-1:typescript",
        },
      });

      expect(provider.status).toBe("ERROR");
      expect(capturedError).not.toBeNull();
      expect((capturedError as unknown as Error)?.message).toContain(
        "SYNC_FAILED",
      );

      provider.destroy();
      doc.destroy();
    });
  });
});
