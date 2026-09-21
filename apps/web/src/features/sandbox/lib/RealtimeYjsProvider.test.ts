import type { AnyWebSocketEnvelope, YjsUpdatePayload } from "@packages/dto";
import { describe, expect, it } from "vitest";
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
});
