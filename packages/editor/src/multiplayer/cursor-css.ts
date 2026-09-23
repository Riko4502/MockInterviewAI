import type { Awareness } from "y-protocols/awareness";

/**
 * Идентификатор DOM-элемента стилей курсоров и выделений Yjs Awareness
 */
export const YJS_AWARENESS_STYLE_ID = "yjs-monaco-awareness-styles";

export function getAwarenessStyleId(awareness: Awareness): string {
  return `${YJS_AWARENESS_STYLE_ID}-${awareness.doc.clientID}`;
}

/**
 * Динамически генерирует и внедряет CSS-стили для курсоров и выделений Yjs Awareness (T021).
 * Стилизует сгенерированные y-monaco классы:
 * .yRemoteSelection-${clientID} и .yRemoteSelectionHead-${clientID}.
 */
export function updateYjsAwarenessStyles(awareness: Awareness) {
  if (typeof document === "undefined") return;
  const styleId = getAwarenessStyleId(awareness);
  let styleEl = document.getElementById(styleId);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const rules: string[] = [
    `
    /* Базовые стили для выделений и курсоров y-monaco */
    .yRemoteSelection {
      background-color: rgba(250, 120, 30, 0.25);
    }
    .yRemoteSelectionHead {
      position: absolute;
      border-left: 2px solid orange;
      box-sizing: border-box;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    }
    `,
  ];

  awareness.getStates().forEach((state, clientID) => {
    if (clientID === awareness.doc.clientID) {
      return;
    }
    const user = (state as { user?: { name?: string; color?: string } })?.user;
    const name = user?.name || `User ${clientID}`;
    const color = user?.color || "#e91e63";

    rules.push(`
      /* Выделение текста клиентом ${clientID} */
      .yRemoteSelection-${clientID} {
        background-color: ${color}40 !important;
      }

      /* Каретка клиентом ${clientID} */
      .yRemoteSelectionHead-${clientID} {
        border-left: 2px solid ${color} !important;
      }

      /* Бейдж с именем соавтора ${clientID} */
      .yRemoteSelectionHead-${clientID}::after {
        content: "${name}";
        position: absolute;
        bottom: 100%;
        left: -2px;
        background-color: ${color};
        color: white;
        font-size: 11px;
        font-weight: 500;
        line-height: 1.2;
        padding: 2px 6px;
        border-radius: 4px 4px 4px 0;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      }
    `);
  });

  styleEl.textContent = rules.join("\n");
}

/**
 * Удаляет динамические стили Awareness из документа при размонтировании.
 */
export function removeYjsAwarenessStyles(awareness?: Awareness) {
  if (typeof document === "undefined") return;
  if (awareness) {
    const styleEl = document.getElementById(getAwarenessStyleId(awareness));
    if (styleEl) {
      styleEl.remove();
    }
  } else {
    const styles = document.querySelectorAll(
      `[id^="${YJS_AWARENESS_STYLE_ID}"]`,
    );
    for (const el of styles) {
      el.remove();
    }
  }
}
