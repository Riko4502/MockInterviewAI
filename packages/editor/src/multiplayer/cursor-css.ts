import type { Awareness } from "y-protocols/awareness";
import type { Collaborator } from "@/components/CodeEditor/types";

/**
 * Динамически генерирует и внедряет CSS-классы для отрисовки чужих курсоров.
 * Используется дизайн "флажка" (как в Google Docs / VS Code Live Share).
 */
export function updateRemoteCursorStyles(collaborators: Collaborator[]) {
  if (typeof document === "undefined") return;
  const STYLE_ID = "monaco-remote-cursors-style";
  let styleEl = document.getElementById(STYLE_ID);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }

  // Генерируем CSS-правила для каждого соавтора, используя переданный цвет
  styleEl.textContent = collaborators
    .map(
      (c) => `
    /* Сама каретка (вертикальная линия) */
    .remote-cursor-${c.id} {
      border-left: 2px solid ${c.color} !important;
      position: absolute;
      z-index: 10;
      pointer-events: none;
    }

    /* Имя соавтора в виде флажка, исходящего из верхней части курсора */
    .remote-cursor-${c.id}::after {
      content: "${c.name}";
      position: absolute;
      bottom: 100%; /* Поднимаем ровно над верхней точкой линии */
      left: -2px;   /* Выравниваем ровно с линией курсора (она 2px шириной) */
      background-color: ${c.color};
      color: white;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.2;
      padding: 2px 6px;
      /* Закругляем всё, кроме нижнего левого угла, чтобы визуально соединить с линией */
      border-radius: 4px 4px 4px 0;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }

    /* Выделение текста (selection) этим соавтором */
    .remote-selection-${c.id} {
      background-color: ${c.color}40 !important; /* 40 = 25% прозрачности в HEX */
    }
  `,
    )
    .join("\n");
}

/**
 * Идентификатор DOM-элемента стилей курсоров и выделений Yjs Awareness
 */
export const YJS_AWARENESS_STYLE_ID = "yjs-monaco-awareness-styles";

/**
 * Динамически генерирует и внедряет CSS-стили для курсоров и выделений Yjs Awareness (T021).
 * Стилизует сгенерированные y-monaco классы:
 * .yRemoteSelection-${clientID} и .yRemoteSelectionHead-${clientID}.
 */
export function updateYjsAwarenessStyles(awareness: Awareness) {
  if (typeof document === "undefined") return;
  let styleEl = document.getElementById(YJS_AWARENESS_STYLE_ID);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = YJS_AWARENESS_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const rules: string[] = [
    `
    /* Базовые стили для выделений и курсоров y-monaco */
    .yRemoteSelection {
      background-color: rgba(250, 120, 30, 0.25);
      position: absolute;
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
export function removeYjsAwarenessStyles() {
  if (typeof document === "undefined") return;
  const styleEl = document.getElementById(YJS_AWARENESS_STYLE_ID);
  if (styleEl) {
    styleEl.remove();
  }
}
