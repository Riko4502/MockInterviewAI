import type { Collaborator } from "@/components/CodeEditor/types";

/**
 * Динамически генерирует и внедряет CSS-классы для отрисовки чужих курсоров.
 * Используется дизайн "флажка" (как в Google Docs / VS Code Live Share).
 */
export function updateRemoteCursorStyles(collaborators: Collaborator[]) {
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
