import type { Collaborator } from "@packages/editor";
import { CodeEditorLazy, getTemplate } from "@packages/editor";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";

const meta = {
  title: "Editor/Multiplayer",
  component: CodeEditorLazy,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
### **CodeEditor — Мультиплеер**

Демонстрация совместного редактирования кода.
Компонент принимает массив соавторов (collaborators) и рисует цветные курсоры-флажки
(каретка + имя участника) поверх кода.

Цвета курсоров приходят снаружи (с бэкенда или из стейт-менеджера apps/web).
Пакет редактора не генерирует цвета самостоятельно.
`,
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ height: "500px", padding: "16px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeEditorLazy>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Статичные курсоры двух участников.
 * Алексей стоит на 2-й строке, Анна выделила текст на 3-4 строке.
 */
export const StaticCursors: Story = {
  render: () => {
    const [code, setCode] = useState(getTemplate("typescript", "algorithm"));
    const collaborators: Collaborator[] = [
      {
        id: "user-123",
        name: "Алексей (Tech Lead)",
        color: "#a855f7",
        cursor: { line: 2, column: 5 },
      },
      {
        id: "user-456",
        name: "Анна (Reviewer)",
        color: "#22c55e",
        cursor: {
          line: 3,
          column: 3,
          selectionEndLine: 3,
          selectionEndColumn: 20,
        },
      },
    ];

    return (
      <CodeEditorLazy
        value={code}
        onChange={setCode}
        language="typescript"
        collaborators={collaborators}
      />
    );
  },
};

/**
 * Анимированный курсор — имитация реального набора текста другим участником.
 * Курсор «Алексея» прыгает по строке каждую секунду.
 */
export const AnimatedCursor: Story = {
  render: () => {
    const [code, setCode] = useState(getTemplate("typescript", "algorithm"));
    const [collaborators, setCollaborators] = useState<Collaborator[]>([
      {
        id: "user-123",
        name: "Алексей (печатает...)",
        color: "#f97316",
        cursor: { line: 2, column: 5 },
      },
    ]);

    useEffect(() => {
      const interval = setInterval(() => {
        setCollaborators((prev) => {
          const newCol = 5 + Math.floor(Math.random() * 20);
          return [
            {
              ...prev[0],
              cursor: { line: 2, column: newCol },
            },
          ];
        });
      }, 800);
      return () => clearInterval(interval);
    }, []);

    return (
      <CodeEditorLazy
        value={code}
        onChange={setCode}
        language="typescript"
        collaborators={collaborators}
        onCursorChange={(pos) => console.log("Мой курсор:", pos)}
      />
    );
  },
};

/**
 * Панельное собеседование — 4 участника одновременно.
 * Показывает, что курсоры не сливаются и не перекрывают друг друга.
 */
export const PanelInterview: Story = {
  render: () => {
    const [code, setCode] = useState(getTemplate("python", "algorithm"));
    const collaborators: Collaborator[] = [
      {
        id: "user-1",
        name: "Кандидат",
        color: "#3b82f6",
        cursor: { line: 2, column: 8 },
      },
      {
        id: "user-2",
        name: "Интервьюер #1",
        color: "#ef4444",
        cursor: { line: 3, column: 5 },
      },
      {
        id: "user-3",
        name: "Интервьюер #2",
        color: "#22c55e",
        cursor: {
          line: 2,
          column: 15,
          selectionEndLine: 2,
          selectionEndColumn: 25,
        },
      },
      {
        id: "user-4",
        name: "Наблюдатель",
        color: "#eab308",
        cursor: { line: 1, column: 1 },
      },
    ];

    return (
      <CodeEditorLazy
        value={code}
        onChange={setCode}
        language="python"
        collaborators={collaborators}
      />
    );
  },
};
