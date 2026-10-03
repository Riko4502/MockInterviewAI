import * as monaco from "monaco-editor";
import { beforeAll, describe, expect, it } from "vitest";
import { MonacoBinding } from "y-monaco";
import * as Y from "yjs";

beforeAll(() => {
  if (typeof window !== "undefined") {
    window.matchMedia =
      window.matchMedia ||
      (() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));

    HTMLCanvasElement.prototype.getContext = ((_contextId: string) => ({
      webkitBackingStorePixelRatio: 1,
      mozBackingStorePixelRatio: 1,
      msBackingStorePixelRatio: 1,
      measureText: () => ({ width: 10 }),
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: [] }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      transform: () => {},
      rect: () => {},
      clip: () => {},
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  }
});

describe("CodeEditor Undo/Redo & CRDT isolation (T016)", () => {
  it("undoes only local changes and preserves remote edits", () => {
    // Инициализация локального документа и Monaco модели
    const localDoc = new Y.Doc();
    const localText = localDoc.getText("monaco");
    localText.insert(0, "const x = 10;");

    const model = monaco.editor.createModel(localText.toString(), "typescript");
    model.setEOL(monaco.editor.EndOfLineSequence.LF);
    const binding = new MonacoBinding(localText, model);

    // UndoManager отслеживает только транзакции, созданные MonacoBinding
    const undoManager = new Y.UndoManager(localText, {
      trackedOrigins: new Set([binding]),
    });

    // 1. Локальный пользователь вносит изменение в Monaco
    model.applyEdits([
      {
        range: new monaco.Range(1, 14, 1, 14),
        text: "\nconst y = 20;",
      },
    ]);

    expect(localText.toString()).toBe("const x = 10;\nconst y = 20;");
    expect(model.getValue()).toBe("const x = 10;\nconst y = 20;");

    // 2. Симулируем соавтора на удалённом документе
    const remoteDoc = new Y.Doc();
    const remoteText = remoteDoc.getText("monaco");
    Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(localDoc));

    // Соавтор добавляет заголовок в начало документа
    remoteText.insert(0, "// Remote Header\n");

    // Вычисляем дельту и доставляем в локальный документ с remote origin
    const remoteDelta = Y.encodeStateAsUpdate(
      remoteDoc,
      Y.encodeStateVector(localDoc),
    );
    const remoteOrigin = "remote-provider";
    Y.applyUpdate(localDoc, remoteDelta, remoteOrigin);

    // Проверяем, что оба изменения применились
    expect(localText.toString()).toBe(
      "// Remote Header\nconst x = 10;\nconst y = 20;",
    );
    expect(model.getValue()).toBe(
      "// Remote Header\nconst x = 10;\nconst y = 20;",
    );

    // 3. Пользователь выполняет Undo
    undoManager.undo();

    // 4. Локальное изменение отменилось, а внешнее изменение соавтора ОСТАЛОСЬ!
    expect(localText.toString()).toBe("// Remote Header\nconst x = 10;");
    expect(model.getValue()).toBe("// Remote Header\nconst x = 10;");

    // 5. Проверяем Redo
    undoManager.redo();
    expect(localText.toString()).toBe(
      "// Remote Header\nconst x = 10;\nconst y = 20;",
    );
    expect(model.getValue()).toBe(
      "// Remote Header\nconst x = 10;\nconst y = 20;",
    );

    // Очистка ресурсов
    undoManager.destroy();
    binding.destroy();
    model.dispose();
    localDoc.destroy();
    remoteDoc.destroy();
  });

  it("prevents cyclical transaction loops between Monaco and Yjs", () => {
    const doc = new Y.Doc();
    const yText = doc.getText("monaco");
    yText.insert(0, "hello");

    const model = monaco.editor.createModel(yText.toString(), "typescript");
    const binding = new MonacoBinding(yText, model);

    const docTransactionOrigins: unknown[] = [];
    doc.on("afterTransaction", (tr) => {
      docTransactionOrigins.push(tr.origin);
    });

    let modelChangeCount = 0;
    model.onDidChangeContent(() => {
      modelChangeCount++;
    });

    // 1. Внешнее обновление (remote)
    const remoteDoc = new Y.Doc();
    const remoteText = remoteDoc.getText("monaco");
    Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(doc));
    remoteText.insert(5, " world");
    const delta = Y.encodeStateAsUpdate(remoteDoc, Y.encodeStateVector(doc));

    docTransactionOrigins.length = 0;
    modelChangeCount = 0;

    // Применяем remote update
    Y.applyUpdate(doc, delta, "remote-provider");

    // Проверяем, что MonacoBinding обновил Monaco и НЕ создал эхо-транзакцию обратно в Yjs
    const echoTransactions = docTransactionOrigins.filter((o) => o === binding);
    expect(echoTransactions.length).toBe(0);
    expect(modelChangeCount).toBe(1);
    expect(model.getValue()).toBe("hello world");

    // 2. Локальное обновление через Monaco
    docTransactionOrigins.length = 0;
    modelChangeCount = 0;

    model.applyEdits([
      {
        range: new monaco.Range(1, 12, 1, 12),
        text: "!",
      },
    ]);

    // Ровно 1 событие Monaco и ровно 1 локальная транзакция binding в Yjs
    expect(modelChangeCount).toBe(1);
    expect(docTransactionOrigins.filter((o) => o === binding).length).toBe(1);
    expect(yText.toString()).toBe("hello world!");

    binding.destroy();
    model.dispose();
    doc.destroy();
    remoteDoc.destroy();
  });

  it("intercepts Monaco undo/redo actions and invokes Yjs UndoManager", () => {
    const doc = new Y.Doc();
    const yText = doc.getText("monaco");
    const model = monaco.editor.createModel("", "typescript");
    const binding = new MonacoBinding(yText, model);
    const undoManager = new Y.UndoManager(yText, {
      trackedOrigins: new Set([binding]),
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const editor = monaco.editor.create(container, { model });

    let undoCalled = false;
    let redoCalled = false;

    const undoAction = editor.addAction({
      id: "yjs-undo",
      label: "Undo",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ],
      run: () => {
        undoCalled = true;
        undoManager.undo();
      },
    });

    const redoAction = editor.addAction({
      id: "yjs-redo",
      label: "Redo",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY,
      ],
      run: () => {
        redoCalled = true;
        undoManager.redo();
      },
    });

    // Локальное изменение
    model.applyEdits([
      {
        range: new monaco.Range(1, 1, 1, 1),
        text: "test code",
      },
    ]);
    expect(yText.toString()).toBe("test code");

    // Запускаем перехваченный undo action
    editor.getAction("yjs-undo")?.run();
    expect(undoCalled).toBe(true);
    expect(yText.toString()).toBe("");

    // Запускаем перехваченный redo action
    editor.getAction("yjs-redo")?.run();
    expect(redoCalled).toBe(true);
    expect(yText.toString()).toBe("test code");

    undoAction.dispose();
    redoAction.dispose();
    editor.dispose();
    container.remove();
    undoManager.destroy();
    binding.destroy();
    model.dispose();
    doc.destroy();
  });
});
