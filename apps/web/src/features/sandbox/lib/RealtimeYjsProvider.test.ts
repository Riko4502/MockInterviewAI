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
      expect(absoluteAnchor!.index).toBe(originalCursorOffset + insertedLength);

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
});
