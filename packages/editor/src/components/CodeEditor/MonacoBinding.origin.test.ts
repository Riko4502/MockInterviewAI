import * as monaco from "monaco-editor";
import { describe, expect, it } from "vitest";
import { MonacoBinding } from "y-monaco";
import * as Y from "yjs";

describe("MonacoBinding origin semantics (T013)", () => {
  it("confirms that e.transaction.origin === binding for local Monaco edits", () => {
    const doc = new Y.Doc();
    const yText = doc.getText("monaco");
    const model = monaco.editor.createModel("", "typescript");

    const binding = new MonacoBinding(yText, model);

    let observedOrigin: unknown = null;
    let eventFired = false;

    yText.observe((event) => {
      eventFired = true;
      observedOrigin = event.transaction.origin;
    });

    // Имитируем локальный пользовательский ввод через applyEdits в Monaco model
    model.applyEdits([
      {
        range: new monaco.Range(1, 1, 1, 1),
        text: "const a = 10;",
      },
    ]);

    expect(eventFired).toBe(true);
    expect(observedOrigin).toBe(binding);
    expect(yText.toString()).toBe("const a = 10;");

    // Проверяем, что внешняя транзакция от другого источника не имеет origin === binding
    const remoteObservedOrigin: unknown = null;
    const remoteOrigin = "remote-provider-instance";

    doc.transact(() => {
      yText.insert(13, " console.log(a);");
    }, remoteOrigin);

    expect(remoteObservedOrigin ?? observedOrigin).toBe(remoteOrigin);
    expect(observedOrigin).not.toBe(binding);

    // Очистка ресурсов
    binding.destroy();
    model.dispose();
    doc.destroy();
  });
});
